'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';
import { useToast } from '@/contexts/ToastContext';
import ThaiDatePicker from '@/components/ThaiDatePicker';

interface Customer { id: number; name: string; email: string; }

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

export default function NewLoanPage() {
  const router = useRouter();
  const { t } = useLang();
  const { pendingToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    customer_id: '', principal: '', interest_rate: '', term_months: '',
    start_date: new Date().toISOString().slice(0, 10), purpose: '', notes: '',
  });
  const [rateType, setRateType] = useState<'annual' | 'monthly'>('monthly');
  const [interestInputType, setInterestInputType] = useState<'rate' | 'amount'>('amount');
  const [scheduleInterest, setScheduleInterest] = useState<string[]>([]);
  const [schedulePrincipal, setSchedulePrincipal] = useState<string[]>([]);
  const [slip, setSlip] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/loan/users?role=customer').then(r => r.json().catch(() => ([]))).then(d => setCustomers(Array.isArray(d) ? d : []));
  }, []);

  // Monthly interest in baht (all 4 combos)
  const flatMonthlyInterest = (() => {
    const val = Number(form.interest_rate) || 0;
    const p   = Number(form.principal)     || 0;
    if (!val) return 0;
    if (interestInputType === 'amount') {
      return r2(rateType === 'annual' ? val / 12 : val);
    }
    // % mode
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

  // Rebuild schedule whenever any key field changes (resets custom edits)
  useEffect(() => {
    const n = Number(form.term_months) || 0;
    if (n > 0 && form.principal) {
      const def = r2(Number(form.principal) * (
        (form.interest_rate
          ? (rateType === 'monthly' ? Number(form.interest_rate) * 12 : Number(form.interest_rate))
          : 0) / 100 / 12
      ));
      setScheduleInterest(Array(n).fill(def > 0 ? String(def) : '0'));
      const p = Number(form.principal);
      const perRow = r2(p / n);
      setSchedulePrincipal(Array(n).fill(String(perRow)));
    } else {
      setScheduleInterest([]);
      setSchedulePrincipal([]);
    }
  }, [form.term_months, form.principal, form.interest_rate, rateType]);

  function resetSchedule() {
    const n = scheduleInterest.length;
    const p = Number(form.principal) || 0;
    const perRow = n > 0 ? r2(p / n) : 0;
    setScheduleInterest(prev => prev.map(() => flatMonthlyInterest > 0 ? String(flatMonthlyInterest) : '0'));
    setSchedulePrincipal(prev => prev.map(() => String(perRow)));
  }

  function setInterestRow(i: number, v: string) {
    setScheduleInterest(prev => { const a = [...prev]; a[i] = v; return a; });
  }

  function setPrincipalRow(i: number, v: string) {
    setSchedulePrincipal(prev => { const a = [...prev]; a[i] = v; return a; });
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const fmt = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const effectiveTerm = scheduleInterest.length > 0 ? scheduleInterest.length : Number(form.term_months) || 0;
  const principalPerMonth = (form.principal && effectiveTerm > 0)
    ? r2(Number(form.principal) / effectiveTerm)
    : 0;

  const totalInterest   = scheduleInterest.reduce((s, v) => s + (Number(v) || 0), 0);
  const totalPrincipalSched = schedulePrincipal.reduce((s, v) => s + (Number(v) || 0), 0);
  const grandTotal      = totalPrincipalSched + totalInterest;

  // Show table only when all required loan fields are filled
  const showTable = !!(
    form.customer_id && form.principal && form.interest_rate &&
    Number(form.term_months) > 0 && form.start_date && scheduleInterest.length > 0
  );

  // PMT summary (shows before table appears; skip for open-ended loans)
  const preview = (form.principal && form.interest_rate && Number(form.term_months) > 0)
    ? calcPMT(Number(form.principal), annualRate, Number(form.term_months))
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('customer_id',   form.customer_id);
      fd.append('principal',     form.principal);
      fd.append('interest_rate', String(annualRate));
      fd.append('term_months',   showTable ? String(scheduleInterest.length) : form.term_months);
      fd.append('start_date',    form.start_date);
      fd.append('purpose',       form.purpose);
      fd.append('notes',         form.notes);
      if (slip) fd.append('slip', slip);
      if (showTable) {
        fd.append('custom_schedule', JSON.stringify(
          scheduleInterest.map((v, i) => ({
            installment_no: i + 1,
            interest_component: Number(v) || 0,
            principal_component: Number(schedulePrincipal[i]) || 0,
          }))
        ));
      }
      const res  = await fetch('/api/loan/loans', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError((data as { error?: string }).error || t.newLoan.failed); return; }
      pendingToast('บันทึกสำเร็จ');
      router.push(`/loan/loans/${data.id}`);
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/loan/loans" className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{t.newLoan.title}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t.newLoan.subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Main fields ─────────────────────────────────────────────────── */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
          {error && <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newLoan.customer}</label>
            <select value={form.customer_id} onChange={e => set('customer_id', e.target.value)} required
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500">
              <option value="">{t.newLoan.selectCustomer}</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </select>
          </div>

          {/* ── Mobile layout ─────────────────────────────────────────────── */}
          <div className="sm:hidden space-y-3">
            {/* toggles row — full width, below customer */}
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
            {/* principal | interest — 2 col */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{t.newLoan.principal}</label>
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

          {/* ── Desktop layout ─────────────────────────────────────────────── */}
          <div className="hidden sm:grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newLoan.principal}</label>
              <input type="number" min="1" step="1" value={form.principal} onChange={e => set('principal', e.target.value)} required placeholder="100000"
                className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.newLoan.interestRate}</label>
              <div className="flex gap-2 mb-2">
                <div className="flex flex-1 bg-slate-700 rounded-lg p-0.5">
                  <button type="button" onClick={() => { setInterestInputType('rate'); set('interest_rate', ''); }}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${interestInputType === 'rate' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    %
                  </button>
                  <button type="button" onClick={() => { setInterestInputType('amount'); set('interest_rate', ''); }}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${interestInputType === 'amount' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    ฿
                  </button>
                </div>
                <div className="flex flex-1 bg-slate-700 rounded-lg p-0.5">
                  <button type="button" onClick={() => setRateType('annual')}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${rateType === 'annual' ? 'bg-slate-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                    {t.newLoan.perYear}
                  </button>
                  <button type="button" onClick={() => setRateType('monthly')}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${rateType === 'monthly' ? 'bg-slate-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                    {t.newLoan.perMonth}
                  </button>
                </div>
              </div>
              <input type="number" min="0" step="0.01" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} required
                placeholder={interestInputType === 'amount' ? (rateType === 'annual' ? '6000' : '500') : (rateType === 'annual' ? '5.00' : '0.42')}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
              {form.interest_rate && flatMonthlyInterest > 0 && (
                <div className="mt-2 flex items-center gap-1.5 bg-slate-700/50 rounded-lg px-3 py-1.5">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newLoan.term}</label>
              <select value={form.term_months} onChange={e => set('term_months', e.target.value)} required
                className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500">
                <option value="">{t.newLoan.selectTerm}</option>
                <option value="0">กำหนดไม่ได้</option>
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <option key={m} value={m}>{m} {t.newLoan.months}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newLoan.startDate}</label>
              <ThaiDatePicker value={form.start_date} onChange={v => set('start_date', v)} required />
            </div>
          </div>

          {/* Preview (only while table not yet shown) */}
          {preview !== null && !showTable && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-400 text-sm font-medium">{t.newLoan.estimatedPayment}</p>
              <p className="text-2xl font-bold text-white mt-1">฿{fmt(preview)}</p>
              <p className="text-slate-400 text-xs mt-1">{t.newLoan.totalRepayable}: ฿{fmt(preview * Number(form.term_months))}</p>
            </div>
          )}
        </div>

        {/* ── Schedule table (appears when all key fields are filled) ───── */}
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
              <div className="border-t border-slate-700 px-4 py-3 flex items-center justify-between" style={{ background: '#141e2e' }}>
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
                  <p className="text-slate-400 text-xs">{t.newLoan.schedTotalInterest} <span className="text-yellow-400 font-bold">฿{fmt(totalInterest)}</span></p>
                  <p className="text-white text-sm font-semibold">{t.newLoan.schedGrandTotal} <span className="text-yellow-400">฿{fmt(grandTotal)}</span></p>
                </div>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="sticky top-0 bg-slate-850 z-10" style={{ background: '#1a2332' }}>
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
                    const principalNum = Number(schedulePrincipal[i]) || 0;
                    const interestNum  = Number(interest) || 0;
                    const rowTotal     = r2(principalNum + interestNum);
                    return (
                      <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-2.5 text-slate-500 text-xs font-medium">{i + 1}</td>
                        <td className="px-4 py-2.5 text-slate-300 text-xs">{dueDate(form.start_date, i + 1)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <input type="text" inputMode="decimal"
                            value={fmtComma(schedulePrincipal[i] ?? '')}
                            onChange={e => setPrincipalRow(i, stripComma(e.target.value))}
                            className="w-28 text-right rounded-md bg-slate-700 border border-slate-600 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-colors"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <input type="text" inputMode="decimal"
                            value={fmtComma(interest)}
                            onChange={e => setInterestRow(i, stripComma(e.target.value))}
                            className="w-28 text-right rounded-md bg-slate-700 border border-slate-600 px-2 py-1 text-xs text-yellow-300 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition-colors"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right text-yellow-400 text-xs font-semibold">฿{fmt(rowTotal)}</td>
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
                <tfoot style={{ background: '#141e2e' }} className="border-t border-slate-700">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-slate-400 text-xs">{t.newLoan.schedTotalInterest}</td>
                    <td className="px-4 py-3 text-right text-yellow-400 text-xs font-bold">฿{fmt(totalInterest)}</td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-slate-200 text-sm font-semibold">{t.newLoan.schedGrandTotal}</td>
                    <td />
                    <td className="px-4 py-3 text-right text-yellow-400 text-base font-bold">฿{fmt(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── Purpose / Notes / Slip ───────────────────────────────────── */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newLoan.notes}</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder={t.newLoan.notesPlaceholder}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newLoan.slip}</label>
            <input type="file" accept="image/*,.pdf" onChange={e => setSlip(e.target.files?.[0] || null)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-yellow-600 file:text-white hover:file:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            {slip && <p className="text-slate-400 text-xs mt-1">{slip.name} ({(slip.size / 1024).toFixed(1)} KB)</p>}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <Link href="/loan/loans" className="flex-1 text-center bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            {t.newLoan.cancel}
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? t.newLoan.creating : t.newLoan.create}
          </button>
        </div>
      </form>
    </div>
  );
}
