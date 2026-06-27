import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

// POST /api/loan/loans/sync-status
// Admin-only: mark loans as 'completed' when principal is fully paid
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = await getDb();

  // Get all non-completed loans
  const loans = await db.collection('loans')
    .find({ status: { $nin: ['completed', 'rejected', 'defaulted'] } })
    .toArray();

  let updated = 0;
  const details: { loan_number: string; reason: string }[] = [];

  for (const loan of loans) {
    let shouldComplete = false;
    let reason = '';

    // Check 1: fixed-term — paid_amount >= total_payment
    if (Number(loan.total_payment) > 0 && Number(loan.paid_amount) >= Number(loan.total_payment)) {
      shouldComplete = true;
      reason = `paid_amount(${loan.paid_amount}) >= total_payment(${loan.total_payment})`;
    }

    // Check 2: schedule principal fully paid
    if (!shouldComplete && Number(loan.principal) > 0) {
      const schedAgg = await db.collection('payment_schedule').aggregate([
        { $match: { loan_id: loan.id as number, status: 'paid' } },
        { $group: { _id: null, principal: { $sum: '$principal_component' } } },
      ]).toArray();
      const principalPaid = schedAgg[0]?.principal ?? 0;
      if (principalPaid >= Number(loan.principal)) {
        shouldComplete = true;
        reason = `principal_paid(${principalPaid}) >= principal(${loan.principal})`;
      }
    }

    if (shouldComplete) {
      await db.collection('loans').updateOne({ id: loan.id }, { $set: { status: 'completed' } });
      updated++;
      details.push({ loan_number: loan.loan_number as string, reason });
    }
  }

  return NextResponse.json({ updated, details });
}
