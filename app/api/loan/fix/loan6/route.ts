import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = await getDb();
  const loanId = 6;

  const schedules = await db.collection('payment_schedule')
    .find({ loan_id: loanId })
    .toArray();

  const idMap: Record<number, any[]> = {};
  schedules.forEach(s => {
    if (!idMap[s.id]) idMap[s.id] = [];
    idMap[s.id].push(s);
  });

  const dupes = Object.entries(idMap).filter(([, records]) => records.length > 1);
  const deleted: any[] = [];

  for (const [id, records] of dupes) {
    const paidRecord = records.find(r => r.status === 'paid');
    const toDelete = records.filter(r => r._id !== paidRecord?._id);

    for (const record of toDelete) {
      await db.collection('payment_schedule').deleteOne({ _id: record._id });
      deleted.push({ id: record.id, installment_no: record.installment_no });
    }
  }

  return NextResponse.json({ success: true, deleted, count: deleted.length });
}
