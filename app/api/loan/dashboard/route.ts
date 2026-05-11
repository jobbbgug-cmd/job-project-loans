import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const isCustomer = user.role === 'customer';
  const custMatch = isCustomer ? { customer_id: user.userId } : {};
  const today = new Date().toISOString().split('T')[0];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

  // ── Loan status summary ────────────────────────────────────────────────────
  const loanStats = await db.collection('loans').aggregate([
    ...(isCustomer ? [{ $match: custMatch }] : []),
    { $group: { _id: '$status', count: { $sum: 1 }, total_principal: { $sum: '$principal' } } },
    { $project: { _id: 0, status: '$_id', count: 1, total_principal: 1 } },
  ]).toArray();

  // ── Total paid & payment count ─────────────────────────────────────────────
  const payStatsPipeline: object[] = [{ $match: { status: 'approved' } }];
  if (isCustomer) {
    payStatsPipeline.push(
      { $lookup: { from: 'loans', localField: 'loan_id', foreignField: 'id', as: 'loan' } },
      { $unwind: '$loan' },
      { $match: { 'loan.customer_id': user.userId } },
    );
  }
  payStatsPipeline.push({ $group: { _id: null, total_paid: { $sum: '$amount' }, payment_count: { $sum: 1 } } });
  const payStats = await db.collection('payments').aggregate(payStatsPipeline).next();

  // ── Outstanding balance ────────────────────────────────────────────────────
  const [principalRes, paidRes] = await Promise.all([
    db.collection('loans').aggregate([
      ...(isCustomer ? [{ $match: custMatch }] : []),
      { $group: { _id: null, total: { $sum: '$principal' } } },
    ]).next(),
    db.collection('payments').aggregate([
      { $match: { status: 'approved' } },
      ...(isCustomer ? [
        { $lookup: { from: 'loans', localField: 'loan_id', foreignField: 'id', as: 'loan' } },
        { $unwind: '$loan' },
        { $match: { 'loan.customer_id': user.userId } },
      ] : []),
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).next(),
  ]);
  const outstandingBalance = (principalRes?.total ?? 0) - (paidRes?.total ?? 0);

  // ── Pending payments ───────────────────────────────────────────────────────
  let pendingPayments = 0;
  if (isCustomer) {
    const res = await db.collection('payments').aggregate([
      { $match: { status: 'pending' } },
      { $lookup: { from: 'loans', localField: 'loan_id', foreignField: 'id', as: 'loan' } },
      { $unwind: '$loan' },
      { $match: { 'loan.customer_id': user.userId } },
      { $count: 'count' },
    ]).next();
    pendingPayments = res?.count ?? 0;
  } else {
    pendingPayments = await db.collection('payments').countDocuments({ status: 'pending' });
  }

  // ── Monthly income (last 6 months) ─────────────────────────────────────────
  const monthlyPipeline: object[] = [{ $match: { status: 'approved', payment_date: { $gte: sixMonthsAgoStr } } }];
  if (isCustomer) {
    monthlyPipeline.push(
      { $lookup: { from: 'loans', localField: 'loan_id', foreignField: 'id', as: 'loan' } },
      { $unwind: '$loan' },
      { $match: { 'loan.customer_id': user.userId } },
    );
  }
  monthlyPipeline.push(
    { $addFields: { month: { $substr: ['$payment_date', 0, 7] } } },
    { $group: { _id: '$month', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $project: { _id: 0, month: '$_id', amount: 1, count: 1 } },
    { $sort: { month: 1 } },
  );
  const monthly = await db.collection('payments').aggregate(monthlyPipeline).toArray();

  // ── Overdue installments ───────────────────────────────────────────────────
  const overdueRes = await db.collection('payment_schedule').aggregate([
    { $match: { due_date: { $lt: today }, status: { $ne: 'paid' } } },
    { $lookup: { from: 'loans', localField: 'loan_id', foreignField: 'id', as: 'loan' } },
    { $unwind: '$loan' },
    { $match: { 'loan.status': 'active', ...(isCustomer ? { 'loan.customer_id': user.userId } : {}) } },
    { $count: 'overdue' },
  ]).next();

  // ── Interest paid (from paid schedule rows) ────────────────────────────────
  const interestPipeline: object[] = [
    { $match: { status: 'paid' } },
    ...(isCustomer ? [
      { $lookup: { from: 'loans', localField: 'loan_id', foreignField: 'id', as: 'loan' } },
      { $unwind: '$loan' },
      { $match: { 'loan.customer_id': user.userId } },
    ] : []),
    { $group: { _id: null, total: { $sum: '$interest_component' } } },
  ];
  const interestRes = await db.collection('payment_schedule').aggregate(interestPipeline).next();

  return NextResponse.json({
    loan_stats: loanStats,
    total_paid: payStats?.total_paid ?? 0,
    payment_count: payStats?.payment_count ?? 0,
    outstanding_balance: outstandingBalance,
    pending_payments: pendingPayments,
    overdue_installments: overdueRes?.overdue ?? 0,
    monthly_income: monthly,
    total_interest_paid: interestRes?.total ?? 0,
  });
}
