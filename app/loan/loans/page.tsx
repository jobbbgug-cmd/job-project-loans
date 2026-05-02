'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Loan { id: number; loan_number: string; customer_name: string; principal: number; interest_rate: number; term_months: number; monthly_payment: number; status: string; start_date: string; paid_amount: number; }
interface User { role: string; }

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400', active: 'bg-emerald-500/20 text-emerald-400',
  completed: 'bg-blue-500/20 text-blue-400', defaulted: 'bg-red-500/20 text-red-400', rejected: 'bg-slate-500/20 text-slate-400'
};

function fmt(n: number) { return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n); }

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/loan/auth/me').then(r => r.json()),
      fetch('/api/loan/loans').then(r => r.json()),
    ]).then(([u, l]) => { setUser(u); setLoans(Array.isArray(l) ? l : []); setLoading(false); });
  }, []);

  const filtered = filter ? loans.filter(l => l.status === filter) : loans;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Loans</h1>
          <p className="text-slate-400 text-sm mt-0.5">{loans.length} total loans</p>
        </div>
        {user && ['admin','staff'].includes(user.role) && (
          <Link href="/loan/loans/new" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + New Loan
          </Link>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {['','pending','active','completed','defaulted','rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === s ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No loans found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
                {['Loan #','Customer','Principal','Rate','Term','Monthly','Paid','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map(loan => (
                  <tr key={loan.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-emerald-400 font-mono text-xs">{loan.loan_number}</td>
                    <td className="px-4 py-3 text-white">{loan.customer_name}</td>
                    <td className="px-4 py-3 text-white">฿{fmt(loan.principal)}</td>
                    <td className="px-4 py-3 text-slate-300">{loan.interest_rate}%</td>
                    <td className="px-4 py-3 text-slate-300">{loan.term_months}m</td>
                    <td className="px-4 py-3 text-white">฿{fmt(loan.monthly_payment)}</td>
                    <td className="px-4 py-3 text-blue-400">฿{fmt(Number(loan.paid_amount))}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_BADGE[loan.status]}`}>{loan.status}</span></td>
                    <td className="px-4 py-3"><Link href={`/loan/loans/${loan.id}`} className="text-slate-400 hover:text-white text-xs">View →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
