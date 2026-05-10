import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { verifyPassword, signLoanToken, setAuthCookie } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  if (!email?.trim() || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const db = await getDb();
  const [user] = await db.collection('users').aggregate([
    { $match: { email: email.trim() } },
    { $lookup: { from: 'roles', localField: 'role_id', foreignField: 'id', as: 'roleDoc' } },
    { $addFields: { role: { $ifNull: [{ $arrayElemAt: ['$roleDoc.name', 0] }, '$role'] } } },
    { $project: { roleDoc: 0 } },
  ]).toArray();

  if (!user || !(await verifyPassword(password, user.password_hash as string))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  if (!user.is_active) {
    return NextResponse.json({ error: 'Account is inactive' }, { status: 403 });
  }

  const token = await signLoanToken({
    userId: user.id as number,
    email: user.email as string,
    name: user.name as string,
    role: user.role as 'admin' | 'staff' | 'customer',
  });
  const response = NextResponse.json({ userId: user.id, email: user.email, name: user.name, role: user.role });
  setAuthCookie(response, token);
  await audit(user.id as number, 'LOGIN', 'user', user.id as number, {}, request.headers.get('x-forwarded-for') ?? undefined);
  return response;
}
