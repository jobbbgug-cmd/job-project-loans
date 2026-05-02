'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Customer { id: number; name: string; email: string; }

function calcPMT(principal: number, annualRate: number, termMonths: number): number {
  if (annualRate === 0) return principal / termMonths;
  const r = annualRate / 100 / 12;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

export default function NewLoanPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ customer_id: '', principal: '', interest_rate: '', term_months: '', start_date: new Date().toISOString().slice(0, 10), purpose: '', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/loan/users?role=customer').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : []));
  }, []);

  const preview = form.principal && form.interest_rate && form.term_months
    ? calcPMT(Number(form.principal), Number(form.interest_rate), Number(form.term_months))
    : null;

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/loan/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: Number(form.customer_id), principal: Number(form.principal), interest_rate: Number(form.interest_rate), term_months: Number(form.term_months), start_date: form.start_date, purpose: form.purpose, notes: form.notes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create loan'); return; }
      router.push(`/loan/loans/${data.id}`);
    } finally { setLoading(false); }
  }

  const fmt = (n: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/loan/loans" className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">New Loan</h1>
          <p className="text-slate-400 text-sm mt-0.5">Create a new loan application</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
        {error && <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Customer *</label>
          <select value={form.customer_id} onChange={e => set('customer_id', e.target.value)} required
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Principal (฿) *</label>
            <input type="number" min="1000" step="1000" value={form.principal} onChange={e => set('principal', e.target.value)} required placeholder="100000"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Annual Interest Rate (%) *</label>
            <input type="number" min="0" max="100" step="0.01" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} required placeholder="5.00"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Term (months) *</label>
            <select value={form.term_months} onChange={e => set('term_months', e.target.value)} required
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">Select term…</option>
              {[3, 6, 12, 18, 24, 36, 48, 60, 84, 120].map(m => <option key={m} value={m}>{m} months</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Date *</label>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} required
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Purpose</label>
          <input type="text" value={form.purpose} onChange={e => set('purpose', e.target.value)} placeholder="e.g. Home renovation, Car purchase…"
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Additional notes…"
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
        </div>

        {preview !== null && (
          <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
            <p className="text-emerald-400 text-sm font-medium">Estimated Monthly Payment</p>
            <p className="text-2xl font-bold text-white mt-1">฿{fmt(preview)}</p>
            <p className="text-slate-400 text-xs mt-1">Total repayable: ฿{fmt(preview * Number(form.term_months))}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Link href="/loan/loans" className="flex-1 text-center bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? 'Creating…' : 'Create Loan'}
          </button>
        </div>
      </form>
    </div>
  );
}
