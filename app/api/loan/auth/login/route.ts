import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/loan-db';
import { verifyPassword, signLoanToken, setAuthCookie } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email?.trim() || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT u.id, u.name, u.email, u.password_hash, u.is_active, r.name AS role
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?`,
      [email.trim()]
    );
    const users = rows as { id: number; name: string; email: string; password_hash: string; is_active: number; role: string }[];

    if (users.length === 0 || !(await verifyPassword(password, users[0].password_hash))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const user = users[0];
    if (!user.is_active) {
      return NextResponse.json({ error: 'Account is inactive' }, { status: 403 });
    }

    const token = await signLoanToken({ userId: user.id, email: user.email, name: user.name, role: user.role as 'admin' | 'staff' | 'customer' });
    const response = NextResponse.json({ userId: user.id, email: user.email, name: user.name, role: user.role });
    setAuthCookie(response, token);
    await audit(user.id, 'LOGIN', 'user', user.id, {}, request.headers.get('x-forwarded-for') ?? undefined);
    return response;
  } finally {
    conn.release();
  }
}
