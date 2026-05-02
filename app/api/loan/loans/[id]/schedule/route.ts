import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const conn = await pool.getConnection();
  try {
    const [loan] = await conn.execute('SELECT customer_id FROM loans WHERE id = ?', [id]);
    const loans = loan as { customer_id: number }[];
    if (loans.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role === 'customer' && loans[0].customer_id !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [rows] = await conn.execute(
      `SELECT ps.*, p.status AS payment_status, p.amount AS paid_amount, p.payment_date,
       p.slip_filename, p.verified_at
       FROM payment_schedule ps
       LEFT JOIN payments p ON p.schedule_id = ps.id AND p.status = 'approved'
       WHERE ps.loan_id = ? ORDER BY ps.installment_no`, [id]
    );
    return NextResponse.json(rows);
  } finally { conn.release(); }
}
