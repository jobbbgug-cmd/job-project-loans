import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user || !['admin', 'staff'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { action, rejection_reason } = await request.json();
  if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT id, loan_id, schedule_id, amount, status FROM payments WHERE id = ?', [id]);
    const payments = rows as { id: number; loan_id: number; schedule_id: number | null; amount: number; status: string }[];
    if (payments.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (payments[0].status !== 'pending') return NextResponse.json({ error: 'Payment is not pending' }, { status: 400 });

    await conn.beginTransaction();
    await conn.execute(
      `UPDATE payments SET status = ?, verified_by = ?, verified_at = NOW(), rejection_reason = ? WHERE id = ?`,
      [newStatus, user.userId, rejection_reason ?? null, id]
    );

    if (action === 'approve' && payments[0].schedule_id) {
      await conn.execute("UPDATE payment_schedule SET status = 'paid' WHERE id = ?", [payments[0].schedule_id]);
    }

    // Check if loan is fully paid
    if (action === 'approve') {
      const [schedRows] = await conn.execute(
        "SELECT COUNT(*) AS pending FROM payment_schedule WHERE loan_id = ? AND status != 'paid'",
        [payments[0].loan_id]
      );
      const pending = (schedRows as { pending: number }[])[0].pending;
      if (pending === 0) {
        await conn.execute("UPDATE loans SET status = 'completed' WHERE id = ?", [payments[0].loan_id]);
      }
    }

    await conn.commit();
    await audit(user.userId, action === 'approve' ? 'APPROVE_PAYMENT' : 'REJECT_PAYMENT', 'payment', Number(id), { newStatus, rejection_reason });
    return NextResponse.json({ success: true, status: newStatus });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
}
