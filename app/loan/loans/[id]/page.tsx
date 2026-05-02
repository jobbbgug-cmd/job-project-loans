'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface Loan { id: number; loan_number: string; customer_name: string; customer_email: string; principal: number; interest_rate: number; term_months: number; monthly_payment: number; status: string; start_date: string; paid_amount: number; purpose: string; notes: string; created_at: string; }
interface Schedule { id: number; installment_no: number; due_date: string; principal_component: number; interest_component: number; amount: number; remaining_balance: number; status: string; paid_date: string | null; }
interface Document { id: number; file_name: string; file_path: string; created_at: string; uploaded_by_name: string; }
interface User { role: string; }

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400', active: 'bg-emerald-500/20 text-emerald-400',
  completed: 'bg-blue-500/20 text-blue-400', defaulted: 'bg-red-500/20 text-red-400', rejected: 'bg-slate-500/20 text-slate-400'
};
const SCH_BADGE: Record<string, string> = {
  pending: 'text-slate-400', paid: 'text-emerald-400', overdue: 'text-red-400'
};

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp)$/i;

function fmt(n: number) { return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loan, setLoan] = useState<Loan | null>(null);
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  async function loadDocs() {
    const d = await fetch(`/api/loan/loans/${id}/documents`).then(r => r.json());
    setDocs(Array.isArray(d) ? d : []);
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/loan/auth/me').then(r => r.json()),
      fetch(`/api/loan/loans/${id}`).then(r => r.json()),
      fetch(`/api/loan/loans/${id}/schedule`).then(r => r.json()),
      fetch(`/api/loan/loans/${id}/documents`).then(r => r.json()),
    ]).then(([u, l, s, d]) => {
      setUser(u);
      setLoan(l.error ? null : l);
      setSchedule(Array.isArray(s) ? s : []);
      setDocs(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, [id]);

  async function doAction(action: 'approve' | 'reject') {
    setActing(true); setError('');
    const res = await fetch(`/api/loan/loans/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Failed'); setActing(false); return; }
    router.refresh();
    const [l, s] = await Promise.all([fetch(`/api/loan/loans/${id}`).then(r => r.json()), fetch(`/api/loan/loans/${id}/schedule`).then(r => r.json())]);
    setLoan(l); setSchedule(Array.isArray(s) ? s : []); setActing(false);
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/loan/loans/${id}/documents`, { method: 'POST', body: fd });
    if (res.ok) await loadDocs();
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function deleteDoc(docId: number) {
    if (!confirm('Delete this document?')) return;
    await fetch(`/api/loan/loans/${id}/documents?doc_id=${docId}`, { method: 'DELETE' });
    await loadDocs();
  }

  if (loading) return <div className="text-slate-400 text-sm">Loading…</div>;
  if (!loan) return <div className="text-slate-400 text-sm">Loan not found.</div>;

  const progress = loan.principal > 0 ? Math.min(100, (Number(loan.paid_amount) / loan.principal) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/loan/loans" className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white font-mono">{loan.loan_number}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_BADGE[loan.status]}`}>{loan.status}</span>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">{loan.customer_name} · {loan.customer_email}</p>
        </div>
        {user && ['admin', 'staff'].includes(user.role) && loan.status === 'pending' && (
          <div className="flex gap-2">
            <button onClick={() => doAction('approve')} disabled={acting} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Approve</button>
            <button onClick={() => doAction('reject')} disabled={acting} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Reject</button>
          </div>
        )}
      </div>

      {error && <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Principal', value: `฿${fmt(loan.principal)}`, color: 'text-white' },
          { label: 'Interest Rate', value: `${loan.interest_rate}% p.a.`, color: 'text-white' },
          { label: 'Term', value: `${loan.term_months} months`, color: 'text-white' },
          { label: 'Monthly Payment', value: `฿${fmt(loan.monthly_payment)}`, color: 'text-emerald-400' },
        ].map(c => (
          <div key={c.label} className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
            <p className="text-slate-400 text-xs mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Repayment Progress</span>
          <span className="text-white font-medium">฿{fmt(Number(loan.paid_amount))} / ฿{fmt(loan.principal)}</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm pt-1">
          <div><span className="text-slate-400">Start Date: </span><span className="text-white">{fmtDate(loan.start_date)}</span></div>
          <div><span className="text-slate-400">Purpose: </span><span className="text-white">{loan.purpose || '—'}</span></div>
          {loan.notes && <div className="col-span-2"><span className="text-slate-400">Notes: </span><span className="text-white">{loan.notes}</span></div>}
        </div>
      </div>

      {/* Actions */}
      {!['completed', 'rejected', 'defaulted'].includes(loan.status) && (
        <div className="flex gap-3">
          <Link href={`/loan/payments/new?loan_id=${loan.id}`} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + Record Payment
          </Link>
        </div>
      )}

      {/* ── Documents / Images ── */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Documents &amp; Images</h2>
          <label className={`cursor-pointer flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${uploading ? 'bg-slate-600 text-slate-400' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
            {uploading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                Uploading…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Image
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={uploadFile} disabled={uploading} />
          </label>
        </div>

        {docs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No documents yet. Click "Add Image" to upload.</div>
        ) : (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {docs.map(doc => (
              <div key={doc.id} className="group relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                {IMAGE_EXT.test(doc.file_path) ? (
                  <button onClick={() => setPreview(doc.file_path)} className="block w-full">
                    <Image
                      src={doc.file_path} alt={doc.file_name}
                      width={200} height={150}
                      className="w-full h-28 object-cover"
                    />
                  </button>
                ) : (
                  <a href={doc.file_path} target="_blank" rel="noreferrer" className="flex items-center justify-center h-28 bg-slate-700">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </a>
                )}
                <div className="px-2 py-1.5">
                  <p className="text-white text-xs truncate">{doc.file_name}</p>
                  <p className="text-slate-500 text-xs">{doc.uploaded_by_name} · {fmtDate(doc.created_at)}</p>
                </div>
                {user && ['admin', 'staff'].includes(user.role) && (
                  <button
                    onClick={() => deleteDoc(doc.id)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600/80 text-white hidden group-hover:flex items-center justify-center transition-colors hover:bg-red-500"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
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

      {/* Amortization schedule */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-sm">Amortization Schedule</h2>
        </div>
        {schedule.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No schedule available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
                {['#', 'Due Date', 'Principal', 'Interest', 'Amount', 'Balance', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-700/50">
                {schedule.map(row => (
                  <tr key={row.id} className={`hover:bg-slate-700/30 transition-colors ${row.status === 'overdue' ? 'bg-red-900/10' : ''}`}>
                    <td className="px-4 py-3 text-slate-400">{row.installment_no}</td>
                    <td className="px-4 py-3 text-white">{fmtDate(row.due_date)}</td>
                    <td className="px-4 py-3 text-white">฿{fmt(Number(row.principal_component))}</td>
                    <td className="px-4 py-3 text-amber-400">฿{fmt(Number(row.interest_component))}</td>
                    <td className="px-4 py-3 text-white font-medium">฿{fmt(Number(row.amount))}</td>
                    <td className="px-4 py-3 text-slate-300">฿{fmt(Number(row.remaining_balance))}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium capitalize ${SCH_BADGE[row.status] ?? 'text-slate-400'}`}>
                        {row.status}{row.paid_date ? ` (${fmtDate(row.paid_date)})` : ''}
                      </span>
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
