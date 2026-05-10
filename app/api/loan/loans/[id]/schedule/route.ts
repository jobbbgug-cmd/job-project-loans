import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const db = await getDb();
  const loan = await db.collection('loans').findOne({ id: Number(id) });
  if (!loan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.role === 'customer' && loan.customer_id !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = new Date().toISOString().split('T')[0];

  const rows = await db.collection('payment_schedule').aggregate([
    { $match: { loan_id: Number(id) } },
    { $lookup: {
      from: 'payments',
      let: { schedId: '$id' },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$schedule_id', '$$schedId'] }, { $eq: ['$status', 'approved'] }] } } },
      ],
      as: 'payment',
    } },
    { $unwind: { path: '$payment', preserveNullAndEmptyArrays: true } },
    { $addFields: {
      payment_status: '$payment.status',
      paid_amount: '$payment.amount',
      payment_date: '$payment.payment_date',
      slip_filename: '$payment.slip_filename',
      verified_at: '$payment.verified_at',
      status: {
        $cond: {
          if: { $eq: ['$status', 'paid'] },
          then: 'paid',
          else: { $cond: { if: { $lt: ['$due_date', today] }, then: 'overdue', else: 'pending' } },
        },
      },
    } },
    { $project: { _id: 0, payment: 0 } },
    { $sort: { installment_no: 1 } },
  ]).toArray();

  return NextResponse.json(rows);
}
