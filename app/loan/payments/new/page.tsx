'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';
import { useToast } from '@/contexts/ToastContext';
import ThaiDatePicker from '@/components/ThaiDatePicker';

interface Loan { id: number; loan_number: string; customer_name: string; monthly_payment: number; status: string; term_months: number; }
interface Schedule { id: number; installment_no: number; due_date: string; due_amount: number; status: string; }

function fmtDate(s: string) { return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }

export default function NewPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLang();
  const { pendingToast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isOpenEnded, setIsOpenEnded] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [form, setForm] = useState({ loan_id: searchParams.get('loan_id') || '', schedule_id: '', amount: '', payment_date: new Date().toISOString().slice(0, 10), notes: '' });
  const [slip, setSlip] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLoans, setLoadingLoans] = useState(true);

  useEffect(() => {
    fetch('/api/loan/loans').then(r => r.json().catch(() => ([]))).then(d => {
      const list = Array.isArray(d) ? d : [];
      setLoans(list);
      setLoadingLoans(false);
      if (form.loan_id) {
        const selected = list.find((l: Loan) => String(l.id) === form.loan_id);
        if (selected) fetchSchedule(form.loan_id, selected);
      }
    });
  }, []);

  async function fetchSchedule(loanId: string, loan: Loan) {
    if (loan.term_months === 0) {
      setIsOpenEnded(true);
      setSchedules([]);
      setForm(f => ({ ...f, schedule_id: '', amount: '' }));
      return;
    }
    setIsOpenEnded(false);
    setLoadingSchedule(true);
    setSchedules([]);
    try {
      const res = await fetch(`/api/loan/loans/${loanId}/schedule`);
      const data = res.ok ? await res.json() : [];
      const list: Schedule[] = Array.isArray(data) ? data : [];
      setSchedules(list);
      const unpaid = list.filter(s => s.status !== 'paid').sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      const nearest = unpaid[0];
      setForm(f => ({
        ...f,
        schedule_id: nearest ? String(nearest.id) : '',
        amount: nearest ? String(nearest.due_amount) : String(loan.monthly_payment),
      }));
    } catch {
      setForm(f => ({ ...f, amount: String(loan.monthly_payment) }));
    } finally {
      setLoadingSchedule(false);
    }
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function onLoanChange(loan_id: string) {
    const selected = loans.find(l => String(l.id) === loan_id);
    setForm(f => ({ ...f, loan_id, schedule_id: '', amount: selected && selected.term_months !== 0 ? String(selected.monthly_payment) : '' }));
    setSchedules([]);
    setIsOpenEnded(false);
    if (loan_id && selected) fetchSchedule(loan_id, selected);
  }

  function onScheduleChange(schedule_id: string) {
    const s = schedules.find(s => String(s.id) === schedule_id);
    setForm(f => ({ ...f, schedule_id, amount: s ? String(s.due_amount) : f.amount }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const fd = new FormData();
      fd.append('loan_id', form.loan_id);
      if (form.schedule_id) fd.append('schedule_id', form.schedule_id);
      fd.append('amount', form.amount);
      fd.append('payment_date', form.payment_date);
      fd.append('notes', form.notes);
      if (slip) fd.append('slip', slip);
      const res = await fetch('/api/loan/payments', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError((data as { error?: string }).error || t.newPayment.failed); return; }
      pendingToast('บันทึกสำเร็จ');
      router.push(`/loan/payments/${(data as { id: number }).id}`);
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
          <h1 className="text-xl font-bold text-white">{t.newPayment.title}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t.newPayment.subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
        {error && <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newPayment.loan}</label>
          <select value={form.loan_id} onChange={e => onLoanChange(e.target.value)} required disabled={loadingLoans}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50">
            <option value="">{loadingLoans ? t.newPayment.loadingLoans : t.newPayment.selectLoan}</option>
            {loans
              .filter(l => !['completed', 'rejected', 'defaulted'].includes(l.status))
              .map(l => (
                <option key={l.id} value={l.id}>
                  {l.loan_number} — {l.customer_name} (฿{fmt(l.monthly_payment)}/mo){l.status !== 'active' ? ` [${t.status[l.status as keyof typeof t.status] ?? l.status}]` : ''}
                </option>
              ))}
          </select>
        </div>

        {isOpenEnded ? (
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3">
            <p className="text-xs text-yellow-400 font-medium">กำหนดไม่ได้ — งวดจะสร้างอัตโนมัติเมื่อบันทึกการชำระ</p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">งวด</label>
            <select value={form.schedule_id} onChange={e => onScheduleChange(e.target.value)}
              disabled={!form.loan_id || loadingSchedule}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50">
              <option value="">
                {!form.loan_id ? 'เลือกสินเชื่อก่อน' : loadingSchedule ? 'กำลังโหลด…' : 'ไม่ระบุงวด'}
              </option>
              {schedules.filter(s => s.status !== 'paid').map(s => (
                <option key={s.id} value={s.id}>
                  งวด {s.installment_no} — ครบกำหนด {fmtDate(s.due_date)} — ฿{new Intl.NumberFormat('th-TH').format(s.due_amount)}
                  {s.status === 'overdue' ? ' ⚠ เลยกำหนด' : ''}
                </option>
              ))}
            </select>
            {form.schedule_id && (() => {
              const s = schedules.find(s => String(s.id) === form.schedule_id);
              return s ? (
                <p className={`text-xs mt-1 ${s.status === 'overdue' ? 'text-red-400' : 'text-yellow-400'}`}>
                  งวดที่ {s.installment_no} · ครบกำหนด {fmtDate(s.due_date)} {s.status === 'overdue' ? '· เลยกำหนดชำระ' : ''}
                </p>
              ) : null;
            })()}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newPayment.amount}</label>
            <input type="number" min="1" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} required placeholder="0.00"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newPayment.date}</label>
            <ThaiDatePicker value={form.payment_date} onChange={v => set('payment_date', v)} required />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newPayment.slip}</label>
          <input type="file" accept="image/*,.pdf" onChange={e => setSlip(e.target.files?.[0] || null)}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-yellow-600 file:text-white hover:file:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
          {slip && <p className="text-slate-400 text-xs mt-1">{t.newPayment.selected}: {slip.name} ({(slip.size / 1024).toFixed(1)} KB)</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newPayment.notes}</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="…"
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/loan/payments" className="flex-1 text-center bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            {t.newPayment.cancel}
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? t.newPayment.submitting : t.newPayment.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
