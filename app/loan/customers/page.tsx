'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';

interface Customer { id: number; name: string; email: string; is_active: number; created_at: string; }

function fmtDate(s: string) { return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { t } = useLang();

  useEffect(() => {
    fetch('/api/loan/users?role=customer').then(r => r.json().catch(() => ([]))).then(d => { setCustomers(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = search
    ? customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
    : customers;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{t.customers.title}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t.customers.totalFmt(customers.length)}</p>
        </div>
        <Link href="/loan/users/new?role=customer" className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          {t.customers.add}
        </Link>
      </div>

      <div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t.customers.search}
          className="w-full max-w-sm rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.customers.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.customers.noFound}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
                {(['name', 'email', 'joined', 'status'] as const).map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{t.customers.cols[h]}</th>
                ))}
                <th className="px-4 py-3" />
              </tr></thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-slate-300">{c.email}</td>
                    <td className="px-4 py-3 text-slate-300">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {c.is_active ? t.customers.active : t.customers.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/loan/loans?customer_id=${c.id}`} className="text-slate-400 hover:text-yellow-400 text-xs transition-colors">{t.customers.viewLoans}</Link>
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
          <div className="p-8 text-center text-slate-400 text-sm">{t.customers.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.customers.noFound}</div>
        ) : filtered.map(c => (
          <div key={c.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="text-white font-medium">{c.name}</div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ml-2 ${c.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                {c.is_active ? t.customers.active : t.customers.inactive}
              </span>
            </div>
            <div className="text-slate-400 text-sm mb-1">{c.email}</div>
            <div className="text-slate-500 text-xs mb-3">{t.customers.cols.joined}: {fmtDate(c.created_at)}</div>
            <div className="flex justify-end pt-3 border-t border-slate-700">
              <Link href={`/loan/loans?customer_id=${c.id}`} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors">{t.customers.viewLoans}</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
