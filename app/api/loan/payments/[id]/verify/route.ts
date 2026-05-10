import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user || !['admin', 'staff'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { action, rejection_reason } = await request.json();
  if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });

  const db = await getDb();
  const payment = await db.collection('payments').findOne({ id: Number(id) });
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (payment.status !== 'pending') return NextResponse.json({ error: 'Payment is not pending' }, { status: 400 });

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  await db.collection('payments').updateOne(
    { id: Number(id) },
    { $set: { status: newStatus, verified_by: user.userId, verified_at: new Date().toISOString(), rejection_reason: rejection_reason ?? null } }
  );

  if (action === 'approve') {
    await db.collection('loans').updateOne(
      { id: payment.loan_id as number },
      { $inc: { paid_amount: payment.amount as number } }
    );
    if (payment.schedule_id) {
      await db.collection('payment_schedule').updateOne(
        { id: payment.schedule_id as number },
        { $set: { status: 'paid', paid_date: new Date().toISOString().split('T')[0] } }
      );
    }

    // Auto-complete loan if fully paid (skip for open-ended loans where total_payment=0)
    const loan = await db.collection('loans').findOne({ id: payment.loan_id as number });
    if (loan && Number(loan.total_payment) > 0 && Number(loan.paid_amount) >= Number(loan.total_payment)) {
      await db.collection('loans').updateOne({ id: loan.id as number }, { $set: { status: 'completed' } });
    }
  }

  await audit(user.userId, action === 'approve' ? 'APPROVE_PAYMENT' : 'REJECT_PAYMENT', 'payment', Number(id), { newStatus, rejection_reason });
  return NextResponse.json({ success: true, status: newStatus });
}
