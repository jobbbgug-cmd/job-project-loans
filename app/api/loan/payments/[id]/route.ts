import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT p.*, l.loan_number, l.customer_id, u.name AS customer_name,
       v.name AS verifier_name, ps.installment_no, ps.due_date
       FROM payments p JOIN loans l ON p.loan_id = l.id
       JOIN users u ON p.paid_by = u.id
       LEFT JOIN users v ON p.verified_by = v.id
       LEFT JOIN payment_schedule ps ON p.schedule_id = ps.id WHERE p.id = ?`, [id]
    );
    const items = rows as { customer_id: number }[];
    if (items.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role === 'customer' && items[0].customer_id !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(items[0]);
  } finally { conn.release(); }
}
