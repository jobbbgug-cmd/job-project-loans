'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';

interface Payment { id: number; payment_number: string | null; loan_number: string; customer_name: string; installment_no: number | null; amount: number; payment_date: string; slip_path: string | null; status: string; notes: string; verified_at: string | null; }
interface User { role: string; }

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400', approved: 'bg-emerald-500/20 text-emerald-400', rejected: 'bg-red-500/20 text-red-400',
};
const PAY_STATUS_LABEL: Record<string, string> = {
  pending: 'รออนุมัติ', approved: 'อนุมัติ', rejected: 'ปฏิเสธ',
};

function fmt(n: number) { return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const { t } = useLang();

  useEffect(() => {
    Promise.all([
      fetch('/api/loan/auth/me').then(r => r.ok ? r.json() : null),
      fetch('/api/loan/payments').then(r => r.ok ? r.json() : []),
    ]).then(([u, p]) => { setUser(u); setPayments(Array.isArray(p) ? p : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function deletePayment(id: number) {
    if (!confirm('ลบรายการนี้?')) return;
    setDeleting(id);
    const res = await fetch(`/api/loan/payments/${id}`, { method: 'DELETE' });
    if (res.ok) setPayments(prev => prev.filter(p => p.id !== id));
    setDeleting(null);
  }

  const filtered = filter ? payments.filter(p => p.status === filter) : payments;
  const statuses = ['', 'pending', 'approved', 'rejected'] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{t.payments.title}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t.payments.totalFmt(payments.length)}</p>
        </div>
        <Link href="/loan/payments/new" className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          {t.payments.record}
        </Link>
      </div>

      {/* Desktop filter buttons */}
      <div className="hidden md:flex gap-2 flex-wrap">
        {statuses.map(s => {
          const activeClass = s === 'approved' ? 'bg-emerald-600 text-white'
            : s === 'rejected' ? 'bg-red-600 text-white'
            : s === 'pending' ? 'bg-yellow-600 text-white'
            : 'bg-slate-600 text-white';
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? activeClass : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
              {s === '' ? t.loans.all : (PAY_STATUS_LABEL[s] ?? s)}
            </button>
          );
        })}
      </div>

      {/* Mobile filter cards */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {statuses.map(s => {
          const count = s === '' ? payments.length : payments.filter(p => p.status === s).length;
          const isActive = filter === s;
          const activeColor = s === 'approved' ? 'bg-emerald-600'
            : s === 'rejected' ? 'bg-red-600'
            : s === 'pending' ? 'bg-yellow-600'
            : 'bg-slate-600';
          const numColor = s === 'approved' ? 'text-emerald-400'
            : s === 'rejected' ? 'text-red-400'
            : s === 'pending' ? 'text-yellow-400'
            : 'text-white';
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-xl p-3 text-center transition-colors ${isActive ? activeColor : 'bg-slate-800 border border-slate-700'}`}>
              <div className={`text-xs font-medium mb-1 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                {s === '' ? t.loans.all : (PAY_STATUS_LABEL[s] ?? s)}
              </div>
              <div className={`text-xl font-bold ${isActive ? 'text-white' : numColor}`}>
                {count}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.payments.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.payments.noFound}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="px-4 py-3 text-left font-medium">เลขที่การชำระเงิน</th>
                <th className="px-4 py-3 text-left font-medium">{t.payments.cols['customer']}</th>
                <th className="px-4 py-3 text-left font-medium">งวด</th>
                {(['amount', 'date', 'slip', 'status'] as const).map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{t.payments.cols[h]}</th>
                ))}
                <th className="px-4 py-3" />
              </tr></thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-blue-400 font-mono text-xs">{p.payment_number ?? '—'}</td>
                    <td className="px-4 py-3 text-white">{p.customer_name}</td>
                    <td className="px-4 py-3 text-slate-300">{p.installment_no ? `งวด ${p.installment_no}` : '—'}</td>
                    <td className="px-4 py-3 text-white font-medium">฿{fmt(Number(p.amount))}</td>
                    <td className="px-4 py-3 text-slate-300">{fmtDate(p.payment_date)}</td>
                    <td className="px-4 py-3">
                      {p.slip_path
                        ? <a href={p.slip_path} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs underline">{t.payments.viewSlip}</a>
                        : <span className="text-slate-500 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[p.status]}`}>
                        {PAY_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/loan/payments/${p.id}`} className="text-slate-400 hover:text-white text-xs">{t.payments.view}</Link>
                        {user && ['admin', 'staff'].includes(user.role) && p.status === 'pending' && (
                          <Link href={`/loan/payments/${p.id}`} className="text-yellow-400 hover:text-yellow-300 text-xs">{t.payments.verify}</Link>
                        )}
                        {user && ['admin', 'staff'].includes(user.role) && (
                          <button onClick={() => deletePayment(p.id)} disabled={deleting === p.id}
                            className="text-red-500 hover:text-red-400 text-xs disabled:opacity-50 transition-colors">
                            {deleting === p.id ? '…' : 'ลบ'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.payments.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.payments.noFound}</div>
        ) : filtered.map(p => (
          <div key={p.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-blue-400 font-mono text-xs mb-0.5">{p.payment_number ?? '—'}</div>
                <div className="text-white font-medium">{p.customer_name}</div>
                {p.installment_no && <div className="text-slate-400 text-xs">งวด {p.installment_no}</div>}
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ml-2 ${STATUS_BADGE[p.status]}`}>
                {PAY_STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mb-3">
              <div>
                <div className="text-slate-500 text-xs">{t.payments.cols.amount}</div>
                <div className="text-white font-medium">฿{fmt(Number(p.amount))}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">{t.payments.cols.date}</div>
                <div className="text-slate-300">{fmtDate(p.payment_date)}</div>
              </div>
              {p.slip_path && (
                <div className="col-span-2">
                  <a href={p.slip_path} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs underline">{t.payments.viewSlip}</a>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
              <Link href={`/loan/payments/${p.id}`} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors">{t.payments.view}</Link>
              {user && ['admin', 'staff'].includes(user.role) && p.status === 'pending' && (
                <Link href={`/loan/payments/${p.id}`} className="px-3 py-1.5 rounded-lg bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/30 text-xs font-medium transition-colors">{t.payments.verify}</Link>
              )}
              {user && ['admin', 'staff'].includes(user.role) && (
                <button onClick={() => deletePayment(p.id)} disabled={deleting === p.id}
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-medium transition-colors disabled:opacity-40">
                  {deleting === p.id ? '…' : 'ลบ'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
