import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (user.role === 'customer' && String(user.userId) !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.address, u.id_number, u.is_active, u.created_at, r.name AS role
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`, [id]
    );
    const items = rows as unknown[];
    if (items.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(items[0]);
  } finally { conn.release(); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (user.role === 'customer' && String(user.userId) !== id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const allowed = ['name', 'phone', 'address', 'id_number', 'is_active'];
  const sets: string[] = [];
  const values: (string | number)[] = [];
  for (const key of allowed) {
    if (body[key] !== undefined) { sets.push(`${key} = ?`); values.push(body[key]); }
  }
  if (sets.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  values.push(id);
  const conn = await pool.getConnection();
  try {
    await conn.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
    await audit(user.userId, 'UPDATE_USER', 'user', Number(id), body);
    return NextResponse.json({ success: true });
  } finally { conn.release(); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const conn = await pool.getConnection();
  try {
    await conn.execute('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    await audit(user.userId, 'DEACTIVATE_USER', 'user', Number(id), {});
    return NextResponse.json({ success: true });
  } finally { conn.release(); }
}
