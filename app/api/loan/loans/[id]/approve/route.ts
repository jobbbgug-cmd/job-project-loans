import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user || !['admin', 'staff'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { action } = await request.json(); // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });

  const newStatus = action === 'approve' ? 'active' : 'rejected';
  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.execute('SELECT id, status FROM loans WHERE id = ?', [id]);
    const loans = existing as { id: number; status: string }[];
    if (loans.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (loans[0].status !== 'pending') return NextResponse.json({ error: 'Loan is not in pending status' }, { status: 400 });
    await conn.execute('UPDATE loans SET status = ?, staff_id = ? WHERE id = ?', [newStatus, user.userId, id]);
    await audit(user.userId, action === 'approve' ? 'APPROVE_LOAN' : 'REJECT_LOAN', 'loan', Number(id), { newStatus });
    return NextResponse.json({ success: true, status: newStatus });
  } finally { conn.release(); }
}
