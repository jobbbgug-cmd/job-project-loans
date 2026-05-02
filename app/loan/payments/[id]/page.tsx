'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Payment { id: number; loan_number: string; loan_id: number; customer_name: string; amount: number; payment_date: string; slip_path: string | null; status: string; notes: string; is_late: boolean; created_at: string; verified_at: string | null; verifier_name: string | null; rejection_reason: string | null; }
interface User { role: string; }

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400', approved: 'bg-emerald-500/20 text-emerald-400', rejected: 'bg-red-500/20 text-red-400'
};

function fmt(n: number) { return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [u, p] = await Promise.all([
      fetch('/api/loan/auth/me').then(r => r.json()),
      fetch(`/api/loan/payments/${id}`).then(r => r.json()),
    ]);
    setUser(u);
    setPayment(p.error ? null : p);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function doAction(action: 'approve' | 'reject') {
    setActing(true); setError('');
    const body: Record<string, string> = { action };
    if (action === 'reject') body.rejection_reason = rejectReason;
    const res = await fetch(`/api/loan/payments/${id}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Failed'); setActing(false); return; }
    setShowReject(false); setRejectReason('');
    await load();
  }

  if (loading) return <div className="text-slate-400 text-sm">Loading…</div>;
  if (!payment) return <div className="text-slate-400 text-sm">Payment not found.</div>;

  const canVerify = user && ['admin', 'staff'].includes(user.role) && payment.status === 'pending';

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/loan/payments" className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Payment #{payment.id}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_BADGE[payment.status]}`}>{payment.status}</span>
            {payment.is_late && <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">Late</span>}
          </div>
          <p className="text-slate-400 text-sm mt-0.5">{payment.customer_name} · <Link href={`/loan/loans/${payment.loan_id}`} className="text-emerald-400 hover:underline">{payment.loan_number}</Link></p>
        </div>
      </div>

      {error && <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
          <div><p className="text-slate-400 text-xs mb-0.5">Amount</p><p className="text-white font-bold text-xl">฿{fmt(Number(payment.amount))}</p></div>
          <div><p className="text-slate-400 text-xs mb-0.5">Payment Date</p><p className="text-white">{fmtDate(payment.payment_date)}</p></div>
          <div><p className="text-slate-400 text-xs mb-0.5">Submitted</p><p className="text-white">{fmtDate(payment.created_at)}</p></div>
          {payment.verified_at && <div><p className="text-slate-400 text-xs mb-0.5">Verified</p><p className="text-white">{fmtDate(payment.verified_at)} by {payment.verifier_name}</p></div>}
          {payment.notes && <div className="col-span-2"><p className="text-slate-400 text-xs mb-0.5">Note</p><p className="text-white">{payment.notes}</p></div>}
          {payment.rejection_reason && <div className="col-span-2"><p className="text-slate-400 text-xs mb-0.5">Reject Reason</p><p className="text-red-400">{payment.rejection_reason}</p></div>}
        </div>

        {payment.slip_path && (
          <div className="border-t border-slate-700 pt-4">
            <p className="text-slate-400 text-xs mb-2">Payment Slip</p>
            <a href={payment.slip_path} target="_blank" rel="noreferrer">
              {payment.slip_path.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={payment.slip_path} alt="Payment slip" className="max-h-64 rounded-lg border border-slate-600 hover:border-emerald-500 transition-colors" />
              ) : (
                <span className="text-blue-400 hover:text-blue-300 text-sm underline">View Slip Document</span>
              )}
            </a>
          </div>
        )}
      </div>

      {canVerify && !showReject && (
        <div className="flex gap-3">
          <button onClick={() => doAction('approve')} disabled={acting} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {acting ? 'Processing…' : 'Approve Payment'}
          </button>
          <button onClick={() => setShowReject(true)} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            Reject Payment
          </button>
        </div>
      )}

      {showReject && (
        <div className="bg-slate-800 rounded-2xl border border-red-500/30 p-5 space-y-3">
          <p className="text-white text-sm font-medium">Reject Reason</p>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Reason for rejection…"
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          <div className="flex gap-3">
            <button onClick={() => setShowReject(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            <button onClick={() => doAction('reject')} disabled={acting} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">{acting ? 'Rejecting…' : 'Confirm Reject'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
