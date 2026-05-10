import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (user.role === 'customer' && String(user.userId) !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const db = await getDb();
  const [found] = await db.collection('users').aggregate([
    { $match: { id: Number(id) } },
    { $lookup: { from: 'roles', localField: 'role_id', foreignField: 'id', as: 'roleDoc' } },
    { $addFields: { role: { $ifNull: [{ $arrayElemAt: ['$roleDoc.name', 0] }, '$role'] } } },
    { $project: { password_hash: 0, _id: 0, roleDoc: 0 } },
  ]).toArray();
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(found);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (user.role === 'customer' && String(user.userId) !== id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const sets: Record<string, unknown> = {};

  const basicFields = ['name', 'phone', 'address', 'id_number', 'is_active'];
  for (const key of basicFields) {
    if (body[key] !== undefined) sets[key] = body[key];
  }

  // email และ role แก้ได้เฉพาะ admin
  if (user.role === 'admin') {
    if (body.email !== undefined) sets.email = body.email;
    if (body.role !== undefined) {
      const db2 = await getDb();
      const roleDoc = await db2.collection('roles').findOne({ name: body.role });
      if (!roleDoc) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      sets.role_id = roleDoc.id;
    }
  }

  if (Object.keys(sets).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  const db = await getDb();
  await db.collection('users').updateOne({ id: Number(id) }, { $set: sets });
  await audit(user.userId, 'UPDATE_USER', 'user', Number(id), body);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const db = await getDb();
  await db.collection('users').updateOne({ id: Number(id) }, { $set: { is_active: false } });
  await audit(user.userId, 'DEACTIVATE_USER', 'user', Number(id), {});
  return NextResponse.json({ success: true });
}
