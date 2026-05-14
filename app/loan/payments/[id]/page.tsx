'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';
import { useToast } from '@/contexts/ToastContext';
import { blobProxy } from '@/lib/blob-url';

interface Payment { id: number; payment_number: string | null; loan_number: string; loan_id: number; customer_name: string; installment_no: number | null; amount: number; payment_date: string; slip_path: string | null; status: string; notes: string; is_late: boolean; created_at: string; verified_at: string | null; verifier_name: string | null; rejection_reason: string | null; payment_type?: string; }

const PTYPE_BADGE: Record<string, string> = {
  principal: 'bg-emerald-500/20 text-emerald-400',
  interest:  'bg-blue-500/20 text-blue-400',
  normal:    'bg-slate-500/20 text-slate-400',
};
const PTYPE_LABEL: Record<string, string> = {
  principal: 'เงินต้น', interest: 'ดอกเบี้ย', normal: 'ชำระปกติ',
};
interface User { role: string; }

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400', approved: 'bg-emerald-500/20 text-emerald-400', rejected: 'bg-red-500/20 text-red-400',
};

function fmt(n: number) { return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const backHref = searchParams.get('from') ?? '/loan/payments';
  const { t } = useLang();
  const { showToast } = useToast();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [u, p] = await Promise.all([
      fetch('/api/loan/auth/me').then(r => r.json().catch(() => ({}))),
      fetch(`/api/loan/payments/${id}`).then(r => r.json().catch(() => ({}))),
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError((data as { error?: string }).error || t.paymentDetail.failed); setActing(false); return; }
    setShowReject(false); setRejectReason('');
    showToast('บันทึกสำเร็จ');
    await load();
  }

  if (loading) return <div className="text-slate-400 text-sm">{t.paymentDetail.loading}</div>;
  if (!payment) return <div className="text-slate-400 text-sm">{t.paymentDetail.notFound}</div>;

  const canVerify = user && ['admin', 'staff'].includes(user.role) && payment.status === 'pending';

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href={backHref} className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white">{t.paymentDetail.title}</h1>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-sm">
            <span className="text-yellow-400 font-mono font-semibold">{payment.payment_number ?? `#${payment.id}`}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{payment.customer_name}</span>
            <span className="text-slate-600">·</span>
            <Link href={`/loan/loans/${payment.loan_id}`} className="text-yellow-400 hover:underline">{payment.loan_number}</Link>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-4">
        <div className="flex items-center justify-end gap-2 -mt-1 mb-1">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${PTYPE_BADGE[payment.payment_type ?? 'normal'] ?? PTYPE_BADGE.normal}`}>
            {PTYPE_LABEL[payment.payment_type ?? 'normal'] ?? 'ชำระปกติ'}
          </span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${STATUS_BADGE[payment.status]}`}>
            {t.status[payment.status as keyof typeof t.status] ?? payment.status}
          </span>
          {payment.is_late && <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-400">{t.paymentDetail.late}</span>}
        </div>
        <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
          <div><p className="text-slate-400 text-xs mb-0.5">{t.paymentDetail.amount}</p><p className="text-white font-bold text-xl">฿{fmt(Number(payment.amount))}</p></div>
          <div><p className="text-slate-400 text-xs mb-0.5">{t.paymentDetail.paymentDate}</p><p className="text-white">{fmtDate(payment.payment_date)}</p></div>
          <div><p className="text-slate-400 text-xs mb-0.5">งวด</p><p className="text-white">{payment.installment_no ? `งวดที่ ${payment.installment_no}` : '—'}</p></div>
          <div><p className="text-slate-400 text-xs mb-0.5">{t.paymentDetail.submitted}</p><p className="text-white">{fmtDate(payment.created_at)}</p></div>
          {payment.verified_at && (
            <div>
              <p className="text-slate-400 text-xs mb-0.5">{t.paymentDetail.verified}</p>
              <p className="text-white">{fmtDate(payment.verified_at)}</p>
              <p className="text-slate-400 text-xs">{t.paymentDetail.verifiedBy} {payment.verifier_name}</p>
            </div>
          )}
          {payment.notes && (
            <div className="col-span-2"><p className="text-slate-400 text-xs mb-0.5">{t.paymentDetail.note}</p><p className="text-white">{payment.notes}</p></div>
          )}
          {payment.rejection_reason && (
            <div className="col-span-2"><p className="text-slate-400 text-xs mb-0.5">{t.paymentDetail.rejectReason}</p><p className="text-red-400">{payment.rejection_reason}</p></div>
          )}
        </div>

        {payment.slip_path && (
          <div className="border-t border-slate-700 pt-4">
            <p className="text-slate-400 text-xs mb-2">{t.paymentDetail.paymentSlip}</p>
            <a href={blobProxy(payment.slip_path)!} target="_blank" rel="noreferrer">
              {payment.slip_path.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={blobProxy(payment.slip_path)!} alt="Payment slip" className="max-h-64 rounded-lg border border-slate-600 hover:border-yellow-500 transition-colors" />
              ) : (
                <span className="text-blue-400 hover:text-blue-300 text-sm underline">{t.paymentDetail.viewSlipDoc}</span>
              )}
            </a>
          </div>
        )}
      </div>

      {canVerify && !showReject && (
        <div className="flex gap-3">
          <button onClick={() => doAction('approve')} disabled={acting} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {acting ? t.paymentDetail.processing : t.paymentDetail.approvePayment}
          </button>
          <button onClick={() => setShowReject(true)} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            {t.paymentDetail.rejectPayment}
          </button>
        </div>
      )}

      {showReject && (
        <div className="bg-slate-800 rounded-2xl border border-red-500/30 p-5 space-y-3">
          <p className="text-white text-sm font-medium">{t.paymentDetail.rejectReasonLabel}</p>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder={t.paymentDetail.rejectPlaceholder}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          <div className="flex gap-3">
            <button onClick={() => setShowReject(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">{t.paymentDetail.cancel}</button>
            <button onClick={() => doAction('reject')} disabled={acting} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {acting ? t.paymentDetail.rejecting : t.paymentDetail.confirmReject}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
