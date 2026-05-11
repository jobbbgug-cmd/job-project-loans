'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';
import { useToast } from '@/contexts/ToastContext';
import ThaiDatePicker from '@/components/ThaiDatePicker';

interface Customer { id: number; name: string; email: string; }
interface ScheduleRow { installment_no: number; interest_component: number; principal_component: number; }

function r2(n: number) { return Math.round(n * 100) / 100; }

function calcPMT(principal: number, annualRate: number, termMonths: number): number {
  if (annualRate === 0) return principal / termMonths;
  const r = annualRate / 100 / 12;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

function dueDate(startDate: string, installmentNo: number): string {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + installmentNo);
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtComma(v: string): string {
  if (!v) return '';
  const n = parseFloat(v);
  return isNaN(n) ? v : new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n);
}
function stripComma(v: string): string { return v.replace(/[^\d.]/g, ''); }

export default function EditLoanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLang();
  const { pendingToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    customer_id: '', principal: '', interest_rate: '', term_months: '',
    start_date: '', notes: '',
  });
  const [rateType, setRateType] = useState<'annual' | 'monthly'>('annual');
  const [interestInputType, setInterestInputType] = useState<'rate' | 'amount'>('rate');
  const [scheduleInterest, setScheduleInterest] = useState<string[]>([]);
  const [schedulePrincipal, setSchedulePrincipal] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Holds pre-loaded schedule so the rebuild useEffect uses it instead of recalculating
  const loadedScheduleRef = useRef<{ interest: string[]; principal: string[] } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/loan/users?role=customer').then(r => r.json().catch(() => ([]))),
      fetch(`/api/loan/loans/${id}`).then(r => r.json().catch(() => ({}))),
      fetch(`/api/loan/loans/${id}/schedule`).then(r => r.json().catch(() => ([]))),
    ]).then(([custs, loan, schedule]) => {
      setCustomers(Array.isArray(custs) ? custs : []);
      if (loan && !loan.error) {
        if (Array.isArray(schedule) && schedule.length > 0) {
          loadedScheduleRef.current = {
            interest:  (schedule as ScheduleRow[]).map(r => String(r.interest_component)),
            principal: (schedule as ScheduleRow[]).map(r => String(r.principal_component)),
          };
        }
        setForm({
          customer_id:   String(loan.customer_id),
          principal:     String(loan.principal),
          interest_rate: String(loan.interest_rate),
          term_months:   String(loan.term_months),
          start_date:    loan.start_date ? loan.start_date.slice(0, 10) : '',
          notes:         loan.notes ?? '',
        });
      }
      setLoading(false);
    });
  }, [id]);

  // Monthly interest in baht (all 4 combos)
  const flatMonthlyInterest = (() => {
    const val = Number(form.interest_rate) || 0;
    const p   = Number(form.principal)     || 0;
    if (!val) return 0;
    if (interestInputType === 'amount') return r2(rateType === 'annual' ? val / 12 : val);
    const annualPct = rateType === 'annual' ? val : val * 12;
    return p ? r2(p * (annualPct / 100 / 12)) : 0;
  })();

  // Annual rate % — used for PMT preview & API submission
  const annualRate = (() => {
    const val = Number(form.interest_rate) || 0;
    const p   = Number(form.principal)     || 0;
    if (!val) return 0;
    if (interestInputType === 'amount') {
      const monthly = rateType === 'annual' ? val / 12 : val;
      return p ? r2((monthly / p) * 12 * 100) : 0;
    }
    return rateType === 'annual' ? val : val * 12;
  })();

  // Rebuild schedule; if pre-loaded data is waiting, use that instead
  useEffect(() => {
    const n = Number(form.term_months) || 0;
    if (loadedScheduleRef.current) {
      const { interest, principal } = loadedScheduleRef.current;
      loadedScheduleRef.current = null;
      setScheduleInterest(interest);
      setSchedulePrincipal(principal);
      return;
    }
    if (n > 0 && form.principal) {
      const def = r2(Number(form.principal) * (
        (form.interest_rate
          ? (rateType === 'monthly' ? Number(form.interest_rate) * 12 : Number(form.interest_rate))
          : 0) / 100 / 12
      ));
      setScheduleInterest(Array(n).fill(def > 0 ? String(def) : '0'));
      setSchedulePrincipal(Array(n).fill(String(r2(Number(form.principal) / n))));
    } else {
      setScheduleInterest([]);
      setSchedulePrincipal([]);
    }
  }, [form.term_months, form.principal, form.interest_rate, rateType]);

  function resetSchedule() {
    const n   = scheduleInterest.length;
    const p   = Number(form.principal) || 0;
    const per = n > 0 ? r2(p / n) : 0;
    setScheduleInterest(prev => prev.map(() => flatMonthlyInterest > 0 ? String(flatMonthlyInterest) : '0'));
    setSchedulePrincipal(prev => prev.map(() => String(per)));
  }

  function setInterestRow(i: number, v: string) {
    setScheduleInterest(prev => { const a = [...prev]; a[i] = v; return a; });
  }
  function setPrincipalRow(i: number, v: string) {
    setSchedulePrincipal(prev => { const a = [...prev]; a[i] = v; return a; });
  }
  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const fmt = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const effectiveTerm       = scheduleInterest.length > 0 ? scheduleInterest.length : Number(form.term_months) || 0;
  const principalPerMonth   = (form.principal && effectiveTerm > 0) ? r2(Number(form.principal) / effectiveTerm) : 0;
  const totalInterest       = scheduleInterest.reduce((s, v) => s + (Number(v) || 0), 0);
  const totalPrincipalSched = schedulePrincipal.reduce((s, v) => s + (Number(v) || 0), 0);
  const grandTotal          = totalPrincipalSched + totalInterest;

  const showTable = !!(
    form.customer_id && form.principal && form.interest_rate &&
    Number(form.term_months) > 0 && form.start_date && scheduleInterest.length > 0
  );
  const preview = (form.principal && form.interest_rate && Number(form.term_months) > 0)
    ? calcPMT(Number(form.principal), annualRate, Number(form.term_months))
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        customer_id:   Number(form.customer_id),
        principal:     Number(form.principal),
        interest_rate: annualRate,
        term_months:   showTable ? scheduleInterest.length : Number(form.term_months),
        start_date:    form.start_date,
        notes:         form.notes || null,
      };
      if (showTable) {
        body.custom_schedule = scheduleInterest.map((v, i) => ({
          installment_no:      i + 1,
          interest_component:  Number(v) || 0,
          principal_component: Number(schedulePrincipal[i]) || 0,
        }));
      }
      const res  = await fetch(`/api/loan/loans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError((data as { error?: string }).error || t.editLoan.failed); return; }
      pendingToast('บันทึกสำเร็จ');
      router.push(`/loan/loans/${id}`);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="text-slate-400 text-sm">{t.loanDetail.loading}</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/loan/loans/${id}`} className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{t.editLoan.title}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t.editLoan.subtitle}</p>
        </div>
      </div>

      {/* Warning banner */}
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
        <svg className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p className="text-yellow-300 text-xs">{t.editLoan.scheduleWarning}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Main fields ──────────────────────────────────────────────── */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
          {error && <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.editLoan.customer}</label>
            <select value={form.customer_id} onChange={e => set('customer_id', e.target.value)} required
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500">
              <option value="">{t.editLoan.selectCustomer}</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </select>
          </div>

          {/* Mobile layout: toggles row → principal/interest grid → hint */}
          <div className="sm:hidden space-y-3">
            <div className="flex gap-2">
              <div className="flex flex-1 bg-slate-700 rounded-lg p-0.5">
                <button type="button" onClick={() => { setInterestInputType('rate'); set('interest_rate', ''); }}
                  className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors ${interestInputType === 'rate' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  %
                </button>
                <button type="button" onClick={() => { setInterestInputType('amount'); set('interest_rate', ''); }}
                  className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors ${interestInputType === 'amount' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  ฿
                </button>
              </div>
              <div className="flex flex-1 bg-slate-700 rounded-lg p-0.5">
                <button type="button" onClick={() => setRateType('annual')}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${rateType === 'annual' ? 'bg-slate-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {t.newLoan.perYear}
                </button>
                <button type="button" onClick={() => setRateType('monthly')}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${rateType === 'monthly' ? 'bg-slate-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {t.newLoan.perMonth}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{t.editLoan.principal}</label>
                <input type="number" min="1" step="1" value={form.principal} onChange={e => set('principal', e.target.value)} required placeholder="100000"
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  อัตราดอกเบี้ย ({interestInputType === 'rate' ? '%' : '฿'})
                </label>
                <input type="number" min="0" step="0.01" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} required
                  placeholder={interestInputType === 'amount' ? (rateType === 'annual' ? '6000' : '500') : (rateType === 'annual' ? '5.00' : '0.42')}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
              </div>
            </div>
            {form.interest_rate && flatMonthlyInterest > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-700/50 rounded-lg px-3 py-2">
                <svg className="w-3 h-3 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-yellow-400 text-xs font-medium">
                  {interestInputType === 'amount'
                    ? `฿${flatMonthlyInterest.toLocaleString('th-TH')} / เดือน`
                    : rateType === 'monthly'
                      ? `${t.newLoan.equivAnnual}: ${(Number(form.interest_rate) * 12).toFixed(2)}% · ฿${flatMonthlyInterest.toLocaleString('th-TH')} / เดือน`
                      : `฿${flatMonthlyInterest.toLocaleString('th-TH')} / เดือน`}
                </p>
              </div>
            )}
          </div>

          {/* Desktop layout */}
          <div className="hidden sm:grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.editLoan.principal}</label>
              <input type="number" min="1" step="1" value={form.principal} onChange={e => set('principal', e.target.value)} required placeholder="100000"
                className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-slate-300">{t.editLoan.interestRate}</label>
                <div className="flex gap-1">
                  <div className="flex gap-0.5 bg-slate-700 rounded-lg p-0.5">
                    <button type="button" onClick={() => { setInterestInputType('rate'); set('interest_rate', ''); }}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${interestInputType === 'rate' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                      %
                    </button>
                    <button type="button" onClick={() => { setInterestInputType('amount'); set('interest_rate', ''); }}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${interestInputType === 'amount' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                      ฿
                    </button>
                  </div>
                  <div className="flex gap-0.5 bg-slate-700 rounded-lg p-0.5">
                    <button type="button" onClick={() => setRateType('annual')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${rateType === 'annual' ? 'bg-slate-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                      {t.newLoan.perYear}
                    </button>
                    <button type="button" onClick={() => setRateType('monthly')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${rateType === 'monthly' ? 'bg-slate-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                      {t.newLoan.perMonth}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-slate-500 text-xs mb-1.5 min-h-[1rem]">
                {form.interest_rate && flatMonthlyInterest > 0
                  ? interestInputType === 'amount'
                    ? `ดอกเบี้ย ฿${flatMonthlyInterest.toLocaleString('th-TH')} / เดือน`
                    : rateType === 'monthly'
                      ? `${t.newLoan.equivAnnual}: ${(Number(form.interest_rate) * 12).toFixed(2)}%`
                      : `ดอกเบี้ย ฿${flatMonthlyInterest.toLocaleString('th-TH')} / เดือน`
                  : ''}
              </p>
              <input type="number" min="0" step="0.01" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} required
                placeholder={interestInputType === 'amount' ? (rateType === 'annual' ? '6000' : '500') : (rateType === 'annual' ? '5.00' : '0.42')}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.editLoan.term}</label>
              <select value={form.term_months} onChange={e => set('term_months', e.target.value)} required
                className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500">
                <option value="">{t.editLoan.selectTerm}</option>
                <option value="0">กำหนดไม่ได้</option>
                {[2, 3, 6, 12, 13, 16, 18, 24, 36].map(m => <option key={m} value={m}>{m} {t.editLoan.months}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.editLoan.startDate}</label>
              <ThaiDatePicker value={form.start_date} onChange={v => set('start_date', v)} required />
            </div>
          </div>

          {/* Preview (only while table not yet shown) */}
          {preview !== null && !showTable && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-400 text-sm font-medium">{t.editLoan.estimatedPayment}</p>
              <p className="text-2xl font-bold text-white mt-1">฿{fmt(preview)}</p>
              <p className="text-slate-400 text-xs mt-1">{t.editLoan.totalRepayable}: ฿{fmt(preview * Number(form.term_months))}</p>
            </div>
          )}
        </div>

        {/* ── Schedule table ────────────────────────────────────────────── */}
        {showTable && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold text-sm">{t.newLoan.scheduleTable}</h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  {form.term_months} {t.newLoan.months} · {t.newLoan.schedCols.interest}
                </p>
              </div>
              <button type="button" onClick={resetSchedule}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {t.newLoan.schedReset}
              </button>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden">
              <div className="max-h-[30rem] overflow-y-auto divide-y divide-slate-700/40">
                {scheduleInterest.map((interest, i) => {
                  const pn = Number(schedulePrincipal[i]) || 0;
                  const ic = Number(interest) || 0;
                  return (
                    <div key={i} className="px-4 py-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 text-xs font-bold shrink-0">{i + 1}</span>
                          <span className="text-slate-400 text-xs">{dueDate(form.start_date, i + 1)}</span>
                        </div>
                        <span className="text-yellow-400 text-sm font-bold">฿{fmt(r2(pn + ic))}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <p className="text-slate-500 text-xs mb-1">{t.newLoan.schedCols.principal}</p>
                          <input type="text" inputMode="decimal"
                            value={fmtComma(schedulePrincipal[i] ?? '')}
                            onChange={e => setPrincipalRow(i, stripComma(e.target.value))}
                            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-yellow-500" />
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs mb-1">{t.newLoan.schedCols.interest}</p>
                          <input type="text" inputMode="decimal"
                            value={fmtComma(interest)}
                            onChange={e => setInterestRow(i, stripComma(e.target.value))}
                            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-yellow-300 text-right focus:outline-none focus:ring-1 focus:ring-yellow-500" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-slate-700 px-4 py-3 flex items-center justify-between" style={{ background: 'var(--schedule-tfoot)' }}>
                <button type="button"
                  onClick={() => {
                    setScheduleInterest(prev => [...prev, flatMonthlyInterest > 0 ? String(r2(flatMonthlyInterest)) : '0']);
                    setSchedulePrincipal(prev => [...prev, principalPerMonth > 0 ? String(principalPerMonth) : '0']);
                  }}
                  className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  เพิ่มงวด
                </button>
                <div className="text-right space-y-0.5">
                  <p className="text-slate-400 text-xs">รวมเงินต้น <span className="text-white font-bold">฿{fmt(totalPrincipalSched)}</span></p>
                  <p className="text-slate-400 text-xs">{t.newLoan.schedTotalInterest} <span className="text-yellow-400 font-bold">฿{fmt(totalInterest)}</span></p>
                  <p className="text-white text-sm font-semibold">{t.newLoan.schedGrandTotal} <span className="text-yellow-400">฿{fmt(grandTotal)}</span></p>
                </div>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="sticky top-0 z-10" style={{ background: 'var(--schedule-thead)' }}>
                  <tr className="border-b border-slate-700 text-slate-400 text-xs">
                    <th className="px-4 py-3 text-left font-medium w-10">{t.newLoan.schedCols.no}</th>
                    <th className="px-4 py-3 text-left font-medium">{t.newLoan.schedCols.dueDate}</th>
                    <th className="px-4 py-3 text-right font-medium">{t.newLoan.schedCols.principal}</th>
                    <th className="px-4 py-3 text-right font-medium">{t.newLoan.schedCols.interest}</th>
                    <th className="px-4 py-3 text-right font-medium">{t.newLoan.schedCols.total}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {scheduleInterest.map((interest, i) => {
                    const pn = Number(schedulePrincipal[i]) || 0;
                    const ic = Number(interest) || 0;
                    return (
                      <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-2.5 text-slate-500 text-xs font-medium">{i + 1}</td>
                        <td className="px-4 py-2.5 text-slate-300 text-xs">{dueDate(form.start_date, i + 1)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <input type="text" inputMode="decimal"
                            value={fmtComma(schedulePrincipal[i] ?? '')}
                            onChange={e => setPrincipalRow(i, stripComma(e.target.value))}
                            className="w-28 text-right rounded-md bg-slate-700 border border-slate-600 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-colors" />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <input type="text" inputMode="decimal"
                            value={fmtComma(interest)}
                            onChange={e => setInterestRow(i, stripComma(e.target.value))}
                            className="w-28 text-right rounded-md bg-slate-700 border border-slate-600 px-2 py-1 text-xs text-yellow-300 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-colors" />
                        </td>
                        <td className="px-4 py-2.5 text-right text-yellow-400 text-xs font-semibold">฿{fmt(r2(pn + ic))}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={5} className="px-4 py-2">
                      <button type="button"
                        onClick={() => {
                          setScheduleInterest(prev => [...prev, flatMonthlyInterest > 0 ? String(r2(flatMonthlyInterest)) : '0']);
                          setSchedulePrincipal(prev => [...prev, principalPerMonth > 0 ? String(principalPerMonth) : '0']);
                        }}
                        className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        เพิ่มงวด
                      </button>
                    </td>
                  </tr>
                </tbody>
                <tfoot style={{ background: 'var(--schedule-tfoot)' }} className="border-t border-slate-700">
                  <tr>
                    <td colSpan={2} className="px-4 py-2.5 text-slate-400 text-xs">รวมเงินต้น</td>
                    <td className="px-4 py-2.5 text-right text-white text-xs font-bold">฿{fmt(totalPrincipalSched)}</td>
                    <td colSpan={2} />
                  </tr>
                  <tr>
                    <td colSpan={2} className="px-4 py-2.5 text-slate-400 text-xs">{t.newLoan.schedTotalInterest}</td>
                    <td />
                    <td className="px-4 py-2.5 text-right text-yellow-400 text-xs font-bold">฿{fmt(totalInterest)}</td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-slate-200 text-sm font-semibold">{t.newLoan.schedGrandTotal}</td>
                    <td colSpan={2} />
                    <td className="px-4 py-3 text-right text-yellow-400 text-base font-bold">฿{fmt(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── Notes ────────────────────────────────────────────────────── */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.editLoan.notes}</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder={t.editLoan.notesPlaceholder}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none" />
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <Link href={`/loan/loans/${id}`} className="flex-1 text-center bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            {t.editLoan.cancel}
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {saving ? t.editLoan.saving : t.editLoan.save}
          </button>
        </div>
      </form>
    </div>
  );
}
