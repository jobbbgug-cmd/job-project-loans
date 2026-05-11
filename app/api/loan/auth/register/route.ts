import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextId } from '@/lib/loan-db';
import { hashPassword } from '@/lib/loan-auth';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
    }

    const db = await getDb();
    const existing = await db.collection('users').findOne({ email: email.trim() });
    if (existing) return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 409 });

    const id = await nextId('users');
    const hash = await hashPassword(password);
    await db.collection('users').insertOne({
      id,
      role: 'customer',
      name: name.trim(),
      email: email.trim(),
      password_hash: hash,
      phone: null,
      address: null,
      id_number: null,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ id, email: email.trim(), name: name.trim() }, { status: 201 });
  } catch (err) {
    console.error('POST /api/loan/auth/register error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
