'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Payment { id: number; loan_number: string; customer_name: string; amount: number; payment_date: string; slip_path: string | null; status: string; notes: string; verified_at: string | null; }
interface User { role: string; }

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400', approved: 'bg-emerald-500/20 text-emerald-400', rejected: 'bg-red-500/20 text-red-400'
};

function fmt(n: number) { return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/loan/auth/me').then(r => r.json()),
      fetch('/api/loan/payments').then(r => r.json()),
    ]).then(([u, p]) => { setUser(u); setPayments(Array.isArray(p) ? p : []); setLoading(false); });
  }, []);

  const filtered = filter ? payments.filter(p => p.status === filter) : payments;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Payments</h1>
          <p className="text-slate-400 text-sm mt-0.5">{payments.length} total payments</p>
        </div>
        <Link href="/loan/payments/new" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Record Payment
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'approved', 'rejected'].map(s => (
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
          <div className="p-8 text-center text-slate-400 text-sm">No payments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
                {['Loan #', 'Customer', 'Amount', 'Date', 'Slip', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-emerald-400 font-mono text-xs">{p.loan_number}</td>
                    <td className="px-4 py-3 text-white">{p.customer_name}</td>
                    <td className="px-4 py-3 text-white font-medium">฿{fmt(Number(p.amount))}</td>
                    <td className="px-4 py-3 text-slate-300">{fmtDate(p.payment_date)}</td>
                    <td className="px-4 py-3">
                      {p.slip_path
                        ? <a href={p.slip_path} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs underline">View</a>
                        : <span className="text-slate-500 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_BADGE[p.status]}`}>{p.status}</span></td>
                    <td className="px-4 py-3 flex items-center gap-3">
                      <Link href={`/loan/payments/${p.id}`} className="text-slate-400 hover:text-white text-xs">View →</Link>
                      {user && ['admin', 'staff'].includes(user.role) && p.status === 'pending' && (
                        <Link href={`/loan/payments/${p.id}`} className="text-yellow-400 hover:text-yellow-300 text-xs">Verify</Link>
                      )}
                    </td>
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
