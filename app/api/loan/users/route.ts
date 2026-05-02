import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/loan-db';
import { getAuthUser, hashPassword } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'staff'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const conn = await pool.getConnection();
  try {
    let sql = `SELECT u.id, u.name, u.email, u.phone, u.id_number, u.is_active, u.created_at, r.name AS role
               FROM users u JOIN roles r ON u.role_id = r.id`;
    const params: (string | number)[] = [];
    if (role) { sql += ' WHERE r.name = ?'; params.push(role); }
    sql += ' ORDER BY u.created_at DESC';
    const [rows] = await conn.execute(sql, params);
    return NextResponse.json(rows);
  } finally { conn.release(); }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, email, password, role, phone, address, id_number } = await request.json();
  if (!name?.trim() || !email?.trim() || !password || !role) {
    return NextResponse.json({ error: 'name, email, password and role are required' }, { status: 400 });
  }
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

  const conn = await pool.getConnection();
  try {
    const [exists] = await conn.execute('SELECT id FROM users WHERE email = ?', [email.trim()]);
    if ((exists as unknown[]).length > 0) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    const [roleRow] = await conn.execute('SELECT id FROM roles WHERE name = ?', [role]);
    if ((roleRow as unknown[]).length === 0) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    const roleId = (roleRow as { id: number }[])[0].id;

    const hash = await hashPassword(password);
    const [result] = await conn.execute(
      'INSERT INTO users (role_id, name, email, password_hash, phone, address, id_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [roleId, name.trim(), email.trim(), hash, phone ?? null, address ?? null, id_number ?? null]
    );
    const newId = (result as { insertId: number }).insertId;
    await audit(user.userId, 'CREATE_USER', 'user', newId, { email: email.trim(), role });
    return NextResponse.json({ id: newId, email: email.trim(), name: name.trim(), role }, { status: 201 });
  } finally { conn.release(); }
}
