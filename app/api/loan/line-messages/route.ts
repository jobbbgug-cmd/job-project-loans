import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = await getDb();
  const rows = await db.collection('line_messages')
    .find({ used: false }, { projection: { _id: 0, id: 1, display_name: 1, message: 1, received_at: 1 } })
    .sort({ received_at: 1 })
    .toArray();
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { ids } = await request.json() as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  const db = await getDb();
  await db.collection('line_messages').updateMany({ id: { $in: ids } }, { $set: { used: true } });
  return NextResponse.json({ ok: true });
}
