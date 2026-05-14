'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';
import { blobProxy } from '@/lib/blob-url';

interface Payment { id: number; loan_id: number; payment_number: string | null; loan_number: string; customer_name: string; installment_no: number | null; amount: number; payment_date: string; slip_path: string | null; status: string; notes: string; verified_at: string | null; loan_principal: number; loan_paid_amount: number; loan_term_months: number; }
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

  // Group all payments by loan for mobile cards
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const loanGroups = useMemo(() => {
    const map = new Map<number, { loan_id: number; loan_number: string; customer_name: string; loan_principal: number; loan_paid_amount: number; loan_term_months: number; payments: Payment[] }>();
    for (const p of payments) {
      if (!map.has(p.loan_id)) map.set(p.loan_id, { loan_id: p.loan_id, loan_number: p.loan_number, customer_name: p.customer_name, loan_principal: p.loan_principal, loan_paid_amount: p.loan_paid_amount, loan_term_months: p.loan_term_months, payments: [] });
      map.get(p.loan_id)!.payments.push(p);
    }
    return Array.from(map.values());
  }, [payments]);
  const filteredGroups = filter ? loanGroups.filter(g => g.payments.some(p => p.status === filter)) : loanGroups;

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
      <div className="grid grid-cols-4 gap-2 md:hidden">
        {statuses.map(s => {
          const count = s === '' ? payments.length : payments.filter(p => p.status === s).length;
          const isActive = filter === s;
          const activeColor = s === 'approved' ? 'bg-emerald-600'
            : s === 'rejected' ? 'bg-red-600'
            : s === 'pending' ? 'bg-yellow-600'
            : 'bg-slate-600';
          const inactiveColor = s === 'approved' ? 'bg-emerald-500/10 border border-emerald-500/30'
            : s === 'rejected' ? 'bg-red-500/10 border border-red-500/30'
            : s === 'pending' ? 'bg-yellow-500/10 border border-yellow-500/30'
            : 'bg-slate-800 border border-slate-700';
          const numColor = s === 'approved' ? 'text-emerald-400'
            : s === 'rejected' ? 'text-red-400'
            : s === 'pending' ? 'text-yellow-400'
            : 'text-white';
          const labelColor = s === 'approved' ? 'text-emerald-400'
            : s === 'rejected' ? 'text-red-400'
            : s === 'pending' ? 'text-yellow-400'
            : 'text-slate-400';
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-xl py-2.5 px-1 text-center transition-all ${isActive ? activeColor : inactiveColor}`}>
              <div className={`text-[10px] font-medium mb-1 leading-tight ${isActive ? '!text-white' : labelColor}`}>
                {s === '' ? t.loans.all : (PAY_STATUS_LABEL[s] ?? s)}
              </div>
              <div className={`text-base font-bold ${isActive ? '!text-white' : numColor}`}>
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
                        ? <a href={blobProxy(p.slip_path)!} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs underline">{t.payments.viewSlip}</a>
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

      {/* Mobile card list — grouped by loan */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.payments.loading}</div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.payments.noFound}</div>
        ) : filteredGroups.map(g => {
          const remaining = Math.max(0, Number(g.loan_principal ?? 0) - Number(g.loan_paid_amount ?? 0));
          const paidInstallments = g.payments.filter(p => p.status === 'approved').length;
          const termMonths = Number(g.loan_term_months ?? 0);
          const pct = termMonths > 0 ? Math.min(100, (paidInstallments / termMonths) * 100) : 0;
          const visiblePayments = filter ? g.payments.filter(p => p.status === filter) : g.payments;
          const isOpen = expanded.has(g.loan_id);
          // overall status of this group for badge
          const hasPending = g.payments.some(p => p.status === 'pending');
          const badgeStatus = filter || (hasPending ? 'pending' : g.payments[0]?.status ?? '');

          const cardAccent = hasPending ? 'border-l-yellow-400'
            : g.payments.every(p => p.status === 'approved') ? 'border-l-emerald-400'
            : g.payments.some(p => p.status === 'rejected') ? 'border-l-red-400'
            : 'border-l-slate-500';

          return (
            <div key={g.loan_id} className={`bg-slate-800 rounded-xl border border-slate-700 border-l-4 ${cardAccent} overflow-hidden`}>
              {/* Card header */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <div className="text-white font-semibold">{g.customer_name}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{g.loan_number}</div>
                  </div>
                  {badgeStatus && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ml-3 ${STATUS_BADGE[badgeStatus] ?? ''}`}>
                      {PAY_STATUS_LABEL[badgeStatus] ?? badgeStatus}
                    </span>
                  )}
                </div>

                {/* Paid / Remaining */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-blue-500/15 border border-blue-500/30 rounded-lg px-3 py-2">
                    <div className="text-blue-400/70 text-[10px] mb-0.5">จ่ายไปแล้ว</div>
                    <div className="text-blue-400 font-bold text-sm">฿{fmt(Number(g.loan_paid_amount ?? 0))}</div>
                  </div>
                  <div className={`rounded-lg px-3 py-2 border ${remaining === 0 ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-yellow-500/15 border-yellow-500/30'}`}>
                    <div className={`text-[10px] mb-0.5 ${remaining === 0 ? 'text-emerald-400/70' : 'text-yellow-400/70'}`}>คงเหลือ</div>
                    <div className={`font-bold text-sm ${remaining === 0 ? 'text-emerald-400' : 'text-yellow-400'}`}>฿{fmt(remaining)}</div>
                  </div>
                </div>

                {/* Installment progress */}
                {termMonths > 0 && (
                  <div className="mb-1">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-400">งวดที่จ่ายแล้ว</span>
                      <span className="text-white font-bold">{paidInstallments}/{termMonths}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Toggle detail */}
              <button
                onClick={() => setExpanded(prev => { const s = new Set(prev); s.has(g.loan_id) ? s.delete(g.loan_id) : s.add(g.loan_id); return s; })}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-slate-700 text-slate-400 text-xs font-medium hover:bg-slate-700/30 transition-colors">
                <span>ดูรายละเอียด ({visiblePayments.length} รายการ)</span>
                <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded payment list */}
              {isOpen && (
                <div className="border-t border-slate-700 divide-y divide-slate-700/50">
                  {visiblePayments.map(p => (
                    <div key={p.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-700/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">฿{fmt(Number(p.amount))}</span>
                          {p.installment_no && <span className="text-slate-500 text-xs">งวด {p.installment_no}</span>}
                        </div>
                        <div className="text-slate-400 text-xs mt-0.5">{fmtDate(p.payment_date)}</div>
                      </div>
                      <Link href={`/loan/payments/${p.id}`}
                        className="px-2.5 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 !text-white text-xs font-medium flex-shrink-0 transition-colors">
                        ดูรายละเอียด
                      </Link>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${STATUS_BADGE[p.status]}`}>
                        {PAY_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
