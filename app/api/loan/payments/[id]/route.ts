import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const db = await getDb();

  const rows = await db.collection('payments').aggregate([
    { $match: { id: Number(id) } },
    { $lookup: { from: 'loans', localField: 'loan_id', foreignField: 'id', as: 'loan' } },
    { $unwind: '$loan' },
    { $lookup: { from: 'users', localField: 'loan.customer_id', foreignField: 'id', as: 'customer' } },
    { $unwind: '$customer' },
    { $lookup: { from: 'users', localField: 'verified_by', foreignField: 'id', as: 'verifier' } },
    { $unwind: { path: '$verifier', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'payment_schedule', localField: 'schedule_id', foreignField: 'id', as: 'schedule' } },
    { $unwind: { path: '$schedule', preserveNullAndEmptyArrays: true } },
    { $addFields: {
      loan_number: '$loan.loan_number',
      customer_id: '$loan.customer_id',
      customer_name: '$customer.name',
      verifier_name: '$verifier.name',
      installment_no: '$schedule.installment_no',
      due_date: '$schedule.due_date',
    } },
    { $project: { _id: 0, loan: 0, customer: 0, verifier: 0, schedule: 0 } },
  ]).next();

  if (!rows) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.role === 'customer' && (rows as { customer_id: number }).customer_id !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(rows);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user || !['admin', 'staff'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const db = await getDb();

  const payment = await db.collection('payments').findOne({ id: Number(id) });
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (payment.slip_filename) {
    const { unlink } = await import('fs/promises');
    const { join } = await import('path');
    await unlink(join(process.cwd(), 'public', 'uploads', 'slips', payment.slip_filename as string)).catch(() => {});
  }

  await db.collection('payments').deleteOne({ id: Number(id) });
  await audit(user.userId, 'DELETE_PAYMENT', 'payment', Number(id), {});
  return NextResponse.json({ success: true });
}
