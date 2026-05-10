import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextId } from '@/lib/loan-db';
import { getAuthUser, hashPassword } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'staff'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  const db = await getDb();
  const pipeline: object[] = [
    { $lookup: { from: 'roles', localField: 'role_id', foreignField: 'id', as: 'roleDoc' } },
    { $addFields: { role: { $ifNull: [{ $arrayElemAt: ['$roleDoc.name', 0] }, '$role'] } } },
    ...(role ? [{ $match: { role } }] : []),
    { $project: { password_hash: 0, _id: 0, roleDoc: 0 } },
    { $sort: { created_at: -1 } },
  ];

  const users = await db.collection('users').aggregate(pipeline).toArray();
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, email, password, role, phone, address, id_number } = await request.json();
  if (!name?.trim() || !email?.trim() || !password || !role) {
    return NextResponse.json({ error: 'name, email, password and role are required' }, { status: 400 });
  }
  if (!['admin', 'staff', 'customer'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

  const db = await getDb();
  const existing = await db.collection('users').findOne({ email: email.trim() });
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

  const id = await nextId('users');
  const hash = await hashPassword(password);
  await db.collection('users').insertOne({
    id,
    role,
    name: name.trim(),
    email: email.trim(),
    password_hash: hash,
    phone: phone ?? null,
    address: address ?? null,
    id_number: id_number ?? null,
    is_active: true,
    created_at: new Date().toISOString(),
  });
  await audit(user.userId, 'CREATE_USER', 'user', id, { email: email.trim(), role });
  return NextResponse.json({ id, email: email.trim(), name: name.trim(), role }, { status: 201 });
}
