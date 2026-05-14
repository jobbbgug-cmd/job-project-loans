'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';
import { useToast } from '@/contexts/ToastContext';
import { blobProxy } from '@/lib/blob-url';

interface Loan { id: number; loan_number: string; customer_name: string; customer_email: string; principal: number; interest_rate: number; term_months: number; monthly_payment: number; status: string; start_date: string; paid_amount: number; purpose: string; notes: string; created_at: string; }
interface Schedule { id: number; installment_no: number; due_date: string; principal_component: number; interest_component: number; amount: number; remaining_balance: number; status: string; paid_date: string | null; }
interface Document { id: number; file_name: string; file_path: string; created_at: string; uploaded_by_name: string; }
interface Payment { id: number; payment_number: string | null; amount: number; payment_date: string; note: string; status: string; verifier_name: string | null; installment_no: number | null; due_date: string | null; slip_path: string | null; created_at: string; }
interface User { role: string; }

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400', active: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-blue-500/20 text-blue-400', defaulted: 'bg-red-500/20 text-red-400', rejected: 'bg-slate-500/20 text-slate-400',
  approved: 'bg-emerald-500/20 text-emerald-400',
};
const SCH_BADGE: Record<string, string> = {
  pending: 'text-slate-400', paid: 'text-emerald-400', overdue: 'text-red-400',
};

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp)$/i;

function fmt(n: number | null | undefined) { return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useLang();
  const { showToast } = useToast();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  async function safeJson(r: Response) {
    try { return await r.json(); } catch { return {}; }
  }

  async function loadDocs() {
    const r = await fetch(`/api/loan/loans/${id}/documents`);
    const d = await safeJson(r);
    setDocs(Array.isArray(d) ? d : []);
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/loan/auth/me').then(safeJson),
      fetch(`/api/loan/loans/${id}`).then(safeJson),
      fetch(`/api/loan/loans/${id}/schedule`).then(safeJson),
      fetch(`/api/loan/loans/${id}/documents`).then(safeJson),
      fetch(`/api/loan/payments?loan_id=${id}`).then(safeJson),
    ]).then(([u, l, s, d, p]) => {
      setUser(u);
      setLoan(l.error ? null : l);
      setSchedule(Array.isArray(s) ? s : []);
      setDocs(Array.isArray(d) ? d : []);
      setPayments(Array.isArray(p) ? p : []);
      setLoading(false);
    });
  }, [id]);

  async function doAction(action: 'approve' | 'reject') {
    setActing(true); setError('');
    const res = await fetch(`/api/loan/loans/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const data = await safeJson(res);
    if (!res.ok) { setError(data.error || t.loanDetail.failed); setActing(false); return; }
    showToast('บันทึกสำเร็จ');
    router.refresh();
    const [l, s] = await Promise.all([fetch(`/api/loan/loans/${id}`).then(safeJson), fetch(`/api/loan/loans/${id}/schedule`).then(safeJson)]);
    setLoan(l); setSchedule(Array.isArray(s) ? s : []); setActing(false);
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/loan/loans/${id}/documents`, { method: 'POST', body: fd });
      if (res.ok) {
        await loadDocs();
        showToast('อัปโหลดสำเร็จ');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('อัปโหลดไม่สำเร็จ: ' + (data.error ?? res.status), 'error');
      }
    } catch {
      showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function deleteDoc(docId: number) {
    if (!confirm('Delete this document?')) return;
    await fetch(`/api/loan/loans/${id}/documents?doc_id=${docId}`, { method: 'DELETE' });
    await loadDocs();
  }

  if (loading) return <div className="text-slate-400 text-sm">{t.loanDetail.loading}</div>;
  if (!loan) return <div className="text-slate-400 text-sm">{t.loanDetail.notFound}</div>;

  const totalPaid = payments.filter(p => p.status !== 'rejected').reduce((s, p) => s + Number(p.amount), 0);
  const approvedPaid = payments.filter(p => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0);
  const pendingPaid = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0);
  const progressApproved = loan.principal > 0 ? Math.min(100, (approvedPaid / loan.principal) * 100) : 0;
  const progressPending = loan.principal > 0 ? Math.min(100 - progressApproved, (pendingPaid / loan.principal) * 100) : 0;
  const paidSchedules = schedule.filter(s => s.status === 'paid');
  const principalPaid = paidSchedules.reduce((s, r) => s + Number(r.principal_component ?? 0), 0);
  const interestPaid = paidSchedules.reduce((s, r) => s + Number(r.interest_component ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/loan/loans" className="text-slate-400 hover:text-white transition-colors mt-1 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-white font-mono">{loan.loan_number}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[loan.status]}`}>
              {t.status[loan.status as keyof typeof t.status] ?? loan.status}
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-0.5 truncate">{loan.customer_name} · {loan.customer_email}</p>
        </div>
        {user && ['admin', 'staff'].includes(user.role) && (
          <Link href={`/loan/loans/${id}/edit`} className="bg-slate-500 hover:bg-slate-400 !text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            <span className="hidden sm:inline">{t.loanDetail.edit}</span>
          </Link>
        )}
      </div>

      {error && <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t.loanDetail.principal, value: `฿${fmt(loan.principal)}`, color: 'text-white' },
          ...(user?.role !== 'customer' ? [{ label: t.loanDetail.interestRate, value: `${loan.interest_rate}${t.loanDetail.pa}`, color: 'text-white' }] : []),
          { label: t.loanDetail.term, value: `${loan.term_months} ${t.loanDetail.months}`, color: 'text-white' },
          { label: t.loanDetail.monthlyPayment, value: `฿${fmt(loan.monthly_payment)}`, color: 'text-yellow-400' },
        ].map(c => (
          <div key={c.label} className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
            <p className="text-slate-400 text-xs mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      {!['completed', 'rejected', 'defaulted'].includes(loan.status) && (
        <div className="flex justify-end">
          <Link href={`/loan/payments/new?loan_id=${loan.id}`} className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {t.loanDetail.recordPayment}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Progress */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">{t.loanDetail.repaymentProgress}</span>
            <span className="text-white font-medium">฿{fmt(totalPaid)} / ฿{fmt(loan.principal)}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
            <div className="h-full bg-yellow-500 transition-all" style={{ width: `${progressApproved}%` }} />
            <div className="h-full bg-yellow-500/70 transition-all" style={{ width: `${progressPending}%` }} />
          </div>
          {pendingPaid > 0 && (
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /><span className="text-yellow-400">อนุมัติแล้ว ฿{fmt(approvedPaid)}</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /><span className="text-yellow-400">รอตรวจสอบ ฿{fmt(pendingPaid)}</span></span>
            </div>
          )}
          <div className={`grid gap-3 ${user?.role === 'customer' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3.5">
              <p className="text-emerald-400/70 text-xs mb-1">เงินต้นที่จ่ายแล้ว</p>
              <p className="text-emerald-400 font-bold text-base font-mono">฿{fmt(principalPaid)}</p>
              {loan.principal > 0 && (
                <p className="text-emerald-400/50 text-xs mt-0.5">จาก ฿{fmt(loan.principal)}</p>
              )}
            </div>
            {user?.role !== 'customer' && (
              <div className="bg-yellow-500/15 border border-yellow-500/30 rounded-xl p-3.5">
                <p className="text-yellow-400/70 text-xs mb-1">ดอกเบี้ยที่จ่ายแล้ว</p>
                <p className="text-yellow-400 font-bold text-base font-mono">฿{fmt(interestPaid)}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm pt-1">
            <div><span className="text-slate-400">{t.loanDetail.startDate}: </span><span className="text-white">{fmtDate(loan.start_date)}</span></div>
            {loan.notes && <div className="col-span-2"><span className="text-slate-400">{t.loanDetail.notes}: </span><span className="text-white">{loan.notes}</span></div>}
          </div>
        </div>

        {/* Documents */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-sm">{t.loanDetail.documents}</h2>
            <p className="text-slate-500 text-xs mt-0.5">{docs.length} {t.loanDetail.files}</p>
          </div>
          {user?.role === 'admin' && (
            <label className={`cursor-pointer flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg transition-all ${uploading ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg shadow-yellow-900/30'}`}>
              {uploading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  {t.loanDetail.uploading}
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  {t.loanDetail.addImage}
                </>
              )}
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={uploadFile} disabled={uploading} />
            </label>
          )}
        </div>

        {docs.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-700/60 flex items-center justify-center">
              <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-slate-400 text-sm font-medium">{t.loanDetail.noDocs}</p>
            {user?.role === 'admin' && (
              <label className="cursor-pointer mt-1 text-xs text-yellow-400 hover:text-yellow-300 underline underline-offset-2 transition-colors">
                {t.loanDetail.addImage}
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={uploadFile} disabled={uploading} />
              </label>
            )}
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            {docs.map(doc => (
              <div key={doc.id} className="group relative flex flex-col md:flex-row rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-lg hover:shadow-xl hover:border-slate-600 transition-all duration-200">
                {IMAGE_EXT.test(doc.file_path) ? (
                  <div className="relative w-full md:w-1/2 flex-shrink-0">
                    <button onClick={() => setPreview(blobProxy(doc.file_path))} className="block w-full">
                      <img src={blobProxy(doc.file_path)!} alt={doc.file_name} className="w-full h-auto" />
                    </button>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                    <button onClick={() => setPreview(blobProxy(doc.file_path))}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="bg-white/10 backdrop-blur-sm rounded-full p-2.5 border border-white/20">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                      </div>
                    </button>
                  </div>
                ) : (
                  <a href={blobProxy(doc.file_path)!} target="_blank" rel="noreferrer" className="w-full md:w-1/2 flex-shrink-0 flex flex-col items-center justify-center min-h-[100px] bg-gradient-to-br from-blue-900/40 to-slate-800 gap-2 group/pdf">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center group-hover/pdf:scale-110 transition-transform duration-200">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <span className="text-blue-400 text-xs font-bold tracking-widest">PDF</span>
                  </a>
                )}
                <div className="hidden md:flex flex-1 px-4 py-3 bg-slate-900 flex-col justify-center gap-1">
                  <p className="text-white text-xs font-medium break-all">{doc.file_name}</p>
                  <p className="text-slate-500 text-xs">{doc.uploaded_by_name}</p>
                  <p className="text-slate-600 text-xs">{fmtDate(doc.created_at)}</p>
                </div>
                {user?.role === 'admin' && (
                  <button onClick={() => deleteDoc(doc.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200 hover:bg-red-500 hover:scale-110 shadow-lg">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Lightbox */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
            <img src={preview} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
            <button onClick={() => setPreview(null)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Approved payments */}
      {payments.length > 0 && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-white font-semibold text-sm">รายการการชำระ</h2>
              <p className="text-slate-500 text-xs mt-0.5">{payments.length} รายการ</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-emerald-400 font-bold text-sm">฿{fmt(payments.filter(p => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0))}</p>
              <p className="text-slate-500 text-xs">รวมชำระ</p>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs">
                  <th className="px-4 py-3 text-left font-medium">เลขที่การชำระเงิน</th>
                  <th className="px-4 py-3 text-left font-medium">งวดที่</th>
                  <th className="px-4 py-3 text-left font-medium">วันที่ชำระ</th>
                  <th className="px-4 py-3 text-right font-medium">จำนวนเงิน</th>
                  <th className="px-4 py-3 text-left font-medium">สลิป</th>
                  <th className="px-4 py-3 text-left font-medium">หมายเหตุ</th>
                  <th className="px-4 py-3 text-left font-medium">สถานะ</th>
                  <th className="px-4 py-3 text-left font-medium">อนุมัติโดย</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-blue-400 font-mono text-xs">{p.payment_number ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{p.installment_no ? `งวด ${p.installment_no}` : '—'}</td>
                    <td className="px-4 py-3 text-white">{fmtDate(p.payment_date)}</td>
                    <td className="px-4 py-3 text-right text-yellow-400 font-mono font-semibold">฿{fmt(Number(p.amount))}</td>
                    <td className="px-4 py-3">
                      {p.slip_path ? <a href={blobProxy(p.slip_path)!} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs underline">ดูสลิป</a> : <span className="text-slate-500 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{p.note || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[p.status] ?? 'bg-slate-500/20 text-slate-400'}`}>
                        {t.status[p.status as keyof typeof t.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{p.verifier_name || '—'}</td>
                    <td className="px-4 py-3">
                      <Link href={`/loan/payments/${p.id}?from=/loan/loans/${id}`} className="text-slate-400 hover:text-white text-xs transition-colors">ดูรายละเอียด</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-600 bg-slate-700/30 font-semibold text-sm">
                  <td colSpan={3} className="px-4 py-3 text-slate-400">รวม</td>
                  <td className="px-4 py-3 text-right text-yellow-400 font-mono">฿{fmt(payments.filter(p => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0))}</td>
                  <td colSpan={5}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-700/50">
            {payments.map((p) => (
              <div key={p.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-blue-400 font-mono text-xs mb-0.5">{p.payment_number ?? '—'}</p>
                    <p className="text-slate-400 text-xs">
                      {p.installment_no ? `งวด ${p.installment_no} · ` : ''}{fmtDate(p.payment_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[p.status] ?? 'bg-slate-500/20 text-slate-400'}`}>
                      {t.status[p.status as keyof typeof t.status] ?? p.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-yellow-400 font-mono font-bold text-base">฿{fmt(Number(p.amount))}</p>
                  <div className="flex items-center gap-3">
                    {p.slip_path && (
                      <a href={blobProxy(p.slip_path)!} target="_blank" rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-medium">สลิป</a>
                    )}
                    <Link href={`/loan/payments/${p.id}?from=/loan/loans/${id}`}
                      className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors">ดู</Link>
                  </div>
                </div>
                {p.verifier_name && <p className="text-slate-500 text-xs mt-1">อนุมัติโดย {p.verifier_name}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Amortization schedule */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-sm">{t.loanDetail.schedule}</h2>
        </div>
        {schedule.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.loanDetail.noSchedule}</div>
        ) : (() => {
          const sumPrincipal = schedule.reduce((s, r) => s + Number(r.principal_component ?? 0), 0);
          const sumInterest  = schedule.reduce((s, r) => s + Number(r.interest_component ?? 0), 0);
          const sumAmount    = schedule.reduce((s, r) => s + Number(r.amount ?? 0), 0);
          return (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
                  {(['no', 'dueDate', 'principal', 'interest', 'amount', 'balance', 'status'] as const).map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{t.loanDetail.schedCols[h]}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-slate-700/50">
                  {schedule.map(row => (
                    <tr key={row.id} className={`hover:bg-slate-700/30 transition-colors ${row.status === 'overdue' ? 'bg-red-900/10' : ''}`}>
                      <td className="px-4 py-3 text-slate-400">{row.installment_no}</td>
                      <td className="px-4 py-3 text-white">{fmtDate(row.due_date)}</td>
                      <td className="px-4 py-3 text-white">฿{fmt(Number(row.principal_component ?? 0))}</td>
                      <td className="px-4 py-3 text-yellow-400">฿{fmt(Number(row.interest_component ?? 0))}</td>
                      <td className="px-4 py-3 text-white font-medium">฿{fmt(Number(row.amount ?? 0))}</td>
                      <td className="px-4 py-3 text-slate-300">฿{fmt(Number(row.principal_component ?? 0) + Number(row.interest_component ?? 0) - Number(row.amount ?? 0))}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${SCH_BADGE[row.status] ?? 'text-slate-400'}`}>
                          {t.status[row.status as keyof typeof t.status] ?? row.status}
                          {row.paid_date ? ` (${fmtDate(row.paid_date)})` : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-700/40 font-semibold">
                    <td colSpan={2} className="px-4 py-3 text-slate-300 text-xs">รวมทั้งหมด</td>
                    <td className="px-4 py-3 text-white font-mono">฿{fmt(sumPrincipal)}</td>
                    <td className="px-4 py-3 text-yellow-400 font-mono">฿{fmt(sumInterest)}</td>
                    <td className="px-4 py-3 text-white font-mono">฿{fmt(sumAmount)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden p-3 space-y-2">
              {schedule.map(row => {
                const isPaid = row.status === 'paid';
                const isOverdue = row.status === 'overdue';
                const cardStyle = isPaid
                  ? 'bg-emerald-500/8 border border-emerald-500/25 border-l-4 border-l-emerald-500'
                  : isOverdue
                  ? 'bg-red-500/8 border border-red-500/25 border-l-4 border-l-red-500'
                  : 'bg-yellow-500/6 border border-yellow-500/30 border-l-4 border-l-yellow-500';
                return (
                  <div key={row.id} className={`rounded-xl px-3 py-3 ${cardStyle}`}>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isPaid ? 'bg-emerald-500/20 text-emerald-400' : isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {row.installment_no}
                        </span>
                        <div>
                          <p className="text-slate-400 text-xs">{fmtDate(row.due_date)}</p>
                          {row.paid_date && <p className="text-emerald-400/70 text-[10px]">จ่ายแล้ว {fmtDate(row.paid_date)}</p>}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPaid ? 'bg-emerald-500/15 text-emerald-400' : isOverdue ? 'bg-red-500/15 text-red-400' : 'bg-yellow-500/15 text-yellow-400'}`}>
                        {t.status[row.status as keyof typeof t.status] ?? row.status}
                      </span>
                    </div>
                    <div className={`grid grid-cols-3 gap-2 pt-2 border-t ${isPaid ? 'border-emerald-500/20' : isOverdue ? 'border-red-500/20' : 'border-yellow-500/20'}`}>
                      <div>
                        <p className="text-slate-500 text-[10px] mb-0.5">{t.loanDetail.schedCols.principal}</p>
                        <p className="text-white text-sm font-medium">฿{fmt(Number(row.principal_component ?? 0))}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-[10px] mb-0.5">{t.loanDetail.schedCols.interest}</p>
                        <p className="text-yellow-400 text-sm font-medium">฿{fmt(Number(row.interest_component ?? 0))}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-[10px] mb-0.5">{t.loanDetail.schedCols.amount}</p>
                        <p className="text-white text-sm font-bold">฿{fmt(Number(row.amount ?? 0))}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Mobile summary */}
              <div className="px-4 py-4 bg-slate-700/40 border-t-2 border-slate-600">
                <p className="text-slate-400 text-xs font-medium mb-3">รวมทั้งหมด</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-slate-500 text-xs">{t.loanDetail.schedCols.principal}</p>
                    <p className="text-white text-sm font-bold font-mono">฿{fmt(sumPrincipal)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">{t.loanDetail.schedCols.interest}</p>
                    <p className="text-yellow-400 text-sm font-bold font-mono">฿{fmt(sumInterest)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">{t.loanDetail.schedCols.amount}</p>
                    <p className="text-white text-sm font-bold font-mono">฿{fmt(sumAmount)}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
          );
        })()}
      </div>
    </div>
  );
}
