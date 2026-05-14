import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const draft = await db.collection('parser_drafts').findOne(
    { user_id: user.userId },
    { projection: { _id: 0 } },
  );
  return NextResponse.json(draft ?? null);
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { rows, transfer_amount } = body;

  const db = await getDb();
  await db.collection('parser_drafts').updateOne(
    { user_id: user.userId },
    { $set: { user_id: user.userId, rows: rows ?? [], transfer_amount: transfer_amount ?? '', updated_at: new Date().toISOString() } },
    { upsert: true },
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  await db.collection('parser_drafts').deleteOne({ user_id: user.userId });
  return NextResponse.json({ ok: true });
}
