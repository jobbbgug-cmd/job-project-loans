'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Loan { id: number; loan_number: string; customer_name: string; monthly_payment: number; status: string; }

export default function NewPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [form, setForm] = useState({ loan_id: searchParams.get('loan_id') || '', amount: '', payment_date: new Date().toISOString().slice(0, 10), notes: '' });
  const [slip, setSlip] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLoans, setLoadingLoans] = useState(true);

  useEffect(() => {
    fetch('/api/loan/loans').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : [];
      setLoans(list);
      setLoadingLoans(false);
      if (form.loan_id) {
        const selected = list.find((l: Loan) => String(l.id) === form.loan_id);
        if (selected && !form.amount) setForm(f => ({ ...f, amount: String(selected.monthly_payment) }));
      }
    });
  }, []);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function onLoanChange(loan_id: string) {
    const selected = loans.find(l => String(l.id) === loan_id);
    setForm(f => ({ ...f, loan_id, amount: selected ? String(selected.monthly_payment) : f.amount }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const fd = new FormData();
      fd.append('loan_id', form.loan_id);
      fd.append('amount', form.amount);
      fd.append('payment_date', form.payment_date);
      fd.append('notes', form.notes);
      if (slip) fd.append('slip', slip);
      const res = await fetch('/api/loan/payments', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to record payment'); return; }
      router.push(`/loan/payments/${data.id}`);
    } finally { setLoading(false); }
  }

  const fmt = (n: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n);

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/loan/payments" className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Record Payment</h1>
          <p className="text-slate-400 text-sm mt-0.5">Submit a loan payment with slip</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
        {error && <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Loan *</label>
          <select value={form.loan_id} onChange={e => onLoanChange(e.target.value)} required disabled={loadingLoans}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50">
            <option value="">{loadingLoans ? 'Loading…' : 'Select loan…'}</option>
            {loans
              .filter(l => !['completed', 'rejected', 'defaulted'].includes(l.status))
              .map(l => (
                <option key={l.id} value={l.id}>
                  {l.loan_number} — {l.customer_name} (฿{fmt(l.monthly_payment)}/mo){l.status !== 'active' ? ` [${l.status}]` : ''}
                </option>
              ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Amount (฿) *</label>
            <input type="number" min="1" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required placeholder="0.00"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Payment Date *</label>
            <input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} required
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Payment Slip (optional)</label>
          <div className="relative">
            <input type="file" accept="image/*,.pdf" onChange={e => setSlip(e.target.files?.[0] || null)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          {slip && <p className="text-slate-400 text-xs mt-1">Selected: {slip.name} ({(slip.size / 1024).toFixed(1)} KB)</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Note</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Payment note or reference…"
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/loan/payments" className="flex-1 text-center bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? 'Submitting…' : 'Submit Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
