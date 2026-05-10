import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user || !['admin', 'staff'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { action } = await request.json();
  if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });

  const db = await getDb();
  const loan = await db.collection('loans').findOne({ id: Number(id) });
  if (!loan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newStatus = action === 'approve' ? 'active' : 'rejected';
  await db.collection('loans').updateOne({ id: Number(id) }, { $set: { status: newStatus, staff_id: user.userId } });
  await audit(user.userId, action === 'approve' ? 'APPROVE_LOAN' : 'REJECT_LOAN', 'loan', Number(id), { newStatus });
  return NextResponse.json({ success: true, status: newStatus });
}
