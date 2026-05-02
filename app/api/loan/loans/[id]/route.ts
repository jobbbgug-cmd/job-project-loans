import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT l.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
       s.name AS staff_name,
       (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.loan_id = l.id AND p.status = 'approved') AS paid_amount
       FROM loans l JOIN users u ON l.customer_id = u.id LEFT JOIN users s ON l.staff_id = s.id WHERE l.id = ?`, [id]
    );
    const items = rows as { customer_id: number }[];
    if (items.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role === 'customer' && items[0].customer_id !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(items[0]);
  } finally { conn.release(); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user || !['admin', 'staff'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const allowed = ['status', 'notes', 'purpose'];
  const sets: string[] = [];
  const values: (string | number)[] = [];
  for (const key of allowed) {
    if (body[key] !== undefined) { sets.push(`${key} = ?`); values.push(body[key]); }
  }
  if (sets.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  values.push(id);
  const conn = await pool.getConnection();
  try {
    await conn.execute(`UPDATE loans SET ${sets.join(', ')} WHERE id = ?`, values);
    await audit(user.userId, 'UPDATE_LOAN', 'loan', Number(id), body);
    return NextResponse.json({ success: true });
  } finally { conn.release(); }
}
