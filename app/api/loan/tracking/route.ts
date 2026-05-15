import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || !['admin', 'staff'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? 'month';

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const next30 = new Date(now);
  next30.setDate(next30.getDate() + 30);
  const next30Str = next30.toISOString().slice(0, 10);

  let schedMatch: Record<string, unknown> = { status: { $in: ['pending', 'overdue'] } };

  if (period === 'overdue') {
    schedMatch = { status: { $in: ['pending', 'overdue'] }, due_date: { $lt: todayStr } };
  } else if (period === 'month') {
    schedMatch = { status: { $in: ['pending', 'overdue'] }, due_date: { $lte: endOfMonth } };
  } else if (period === '30days') {
    schedMatch = { status: { $in: ['pending', 'overdue'] }, due_date: { $lte: next30Str } };
  }

  const db = await getDb();
  const rows = await db.collection('payment_schedule').aggregate([
    { $match: schedMatch },
    { $lookup: { from: 'loans', localField: 'loan_id', foreignField: 'id', as: 'loan' } },
    { $unwind: '$loan' },
    { $match: { 'loan.status': { $nin: ['completed', 'rejected', 'defaulted'] } } },
    { $lookup: { from: 'users', localField: 'loan.customer_id', foreignField: 'id', as: 'customer' } },
    { $unwind: '$customer' },
    { $addFields: {
      loan_number: '$loan.loan_number',
      loan_status: '$loan.status',
      customer_name: '$customer.name',
      customer_id: '$loan.customer_id',
    } },
    { $project: { _id: 0, loan: 0, customer: 0 } },
    { $sort: { due_date: 1, loan_id: 1 } },
  ]).toArray();

  return NextResponse.json(rows);
}
