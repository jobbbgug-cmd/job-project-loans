'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';

interface Loan { id: number; loan_number: string; customer_name: string; principal: number; interest_rate: number; term_months: number; monthly_payment: number; status: string; start_date: string; paid_amount: number; principal_paid: number; }
interface User { role: string; }

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400', active: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-blue-500/20 text-blue-400', defaulted: 'bg-red-500/20 text-red-400', rejected: 'bg-slate-500/20 text-slate-400',
};

function fmt(n: number) { return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n); }

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const { t } = useLang();

  useEffect(() => {
    Promise.all([
      fetch('/api/loan/auth/me').then(r => r.json().catch(() => ({}))),
      fetch('/api/loan/loans').then(r => r.json().catch(() => ([]))),
    ]).then(([u, l]) => { setUser(u); setLoans(Array.isArray(l) ? l : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function deleteLoan(id: number) {
    if (!confirm('ลบสินเชื่อนี้? รายการชำระและตารางงวดทั้งหมดจะถูกลบด้วย')) return;
    setDeleting(id);
    const res = await fetch(`/api/loan/loans/${id}`, { method: 'DELETE' });
    if (res.ok) setLoans(prev => prev.filter(l => l.id !== id));
    setDeleting(null);
  }

  const filtered = filter ? loans.filter(l => l.status === filter) : loans;
  const statuses = ['', 'pending', 'completed'] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{t.loans.title}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t.loans.totalFmt(loans.length)}</p>
        </div>
        {user && ['admin', 'staff'].includes(user.role) && (
          <Link href="/loan/loans/new" className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {t.loans.newLoan}
          </Link>
        )}
      </div>

      {/* Desktop filter buttons */}
      <div className="hidden md:flex gap-2 flex-wrap">
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? (s === 'completed' ? 'bg-emerald-600 !text-white' : 'bg-yellow-600 !text-white') : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
            {s === '' ? t.loans.all : (t.status[s as keyof typeof t.status] ?? s)}
          </button>
        ))}
      </div>

      {/* Mobile filter cards */}
      <div className="grid grid-cols-3 gap-3 md:hidden">
        {statuses.map(s => {
          const count = s === '' ? loans.length : loans.filter(l => l.status === s).length;
          const isActive = filter === s;
          const activeColor = s === 'completed' ? 'bg-emerald-600' : 'bg-yellow-600';
          const inactiveColor = s === 'completed' ? 'bg-emerald-500/10 border border-emerald-500/30'
            : s === 'pending' ? 'bg-yellow-500/10 border border-yellow-500/30'
            : 'bg-slate-800 border border-slate-700';
          const numColor = s === 'completed' ? 'text-emerald-400'
            : s === 'pending' ? 'text-yellow-400'
            : 'text-white';
          const labelColor = s === 'completed' ? 'text-emerald-400'
            : s === 'pending' ? 'text-yellow-400'
            : 'text-slate-400';
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-xl p-3 text-center transition-all ${isActive ? activeColor : inactiveColor}`}>
              <div className={`text-xs font-medium mb-1 ${isActive ? '!text-white' : labelColor}`}>
                {s === '' ? t.loans.all : (t.status[s as keyof typeof t.status] ?? s)}
              </div>
              <div className={`text-xl font-bold ${isActive ? '!text-white' : numColor}`}>
                {count}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.loans.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.loans.noFound}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
                {(['loanNo', 'customer', 'principal', 'rate', 'term', 'monthly', 'paid', 'status'] as const).map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{t.loans.cols[h]}</th>
                ))}
                <th className="px-4 py-3" />
              </tr></thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map(loan => (
                  <tr key={loan.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-yellow-400 font-mono text-xs">{loan.loan_number}</td>
                    <td className="px-4 py-3 text-white">{loan.customer_name}</td>
                    <td className="px-4 py-3 text-white">฿{fmt(loan.principal)}</td>
                    <td className="px-4 py-3 text-slate-300">{loan.interest_rate}%</td>
                    <td className="px-4 py-3 text-slate-300">{loan.term_months} {t.loanDetail.months}</td>
                    <td className="px-4 py-3 text-white">฿{fmt(loan.monthly_payment)}</td>
                    <td className="px-4 py-3 text-emerald-400">฿{fmt(Number(loan.paid_amount))}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[loan.status]}`}>
                        {t.status[loan.status as keyof typeof t.status] ?? loan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/loan/loans/${loan.id}`} className="text-xs font-medium !text-white bg-yellow-600 hover:bg-yellow-500 px-2.5 py-1 rounded-lg transition-colors">ดูรายละเอียด</Link>
                        {user && ['admin', 'staff'].includes(user.role) && (
                          <Link href={`/loan/loans/${loan.id}/edit`} className="text-slate-500 hover:text-slate-300 transition-colors" title="แก้ไข">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </Link>
                        )}
                        {user?.role === 'admin' && (
                          <button onClick={() => deleteLoan(loan.id)} disabled={deleting === loan.id}
                            className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50 transition-colors">
                            {deleting === loan.id ? '…' : 'ลบ'}
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
          <div className="p-8 text-center text-slate-400 text-sm">{t.loans.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.loans.noFound}</div>
        ) : filtered.map(loan => (
          <div key={loan.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-yellow-400 font-mono text-xs mb-0.5">{loan.loan_number}</div>
                <div className="text-white font-medium">{loan.customer_name}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ml-2 ${STATUS_BADGE[loan.status]}`}>
                {t.status[loan.status as keyof typeof t.status] ?? loan.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mb-3">
              <div>
                <div className="text-slate-500 text-xs">{t.loans.cols.principal}</div>
                <div className="text-white font-medium">฿{fmt(loan.principal)}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">{t.loans.cols.monthly}</div>
                <div className="text-white">฿{fmt(loan.monthly_payment)}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">{t.loans.cols.rate} / {t.loans.cols.term}</div>
                <div className="text-slate-300">{loan.interest_rate}% / {loan.term_months} {t.loanDetail.months}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">{t.loans.cols.paid}</div>
                <div className="text-emerald-400">฿{fmt(Number(loan.paid_amount))}</div>
              </div>
            </div>
            {/* Progress bar — uses principal_paid (principal component only) vs total principal */}
            {loan.principal > 0 && (() => {
              const principalPaid = Number(loan.principal_paid ?? 0);
              const pct = Math.min(100, (principalPaid / loan.principal) * 100);
              return (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">เงินต้นที่จ่ายแล้ว</span>
                    <span className="text-yellow-400 font-medium">฿{fmt(principalPaid)} / ฿{fmt(loan.principal)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
              <Link href={`/loan/loans/${loan.id}`} className="px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-medium transition-colors">ดูรายละเอียด</Link>
              {user && ['admin', 'staff'].includes(user.role) && (
                <Link href={`/loan/loans/${loan.id}/edit`} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors" title="แก้ไข">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </Link>
              )}
              {user?.role === 'admin' && (
                <button onClick={() => deleteLoan(loan.id)} disabled={deleting === loan.id}
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-medium transition-colors disabled:opacity-40">
                  {deleting === loan.id ? '…' : 'ลบ'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
