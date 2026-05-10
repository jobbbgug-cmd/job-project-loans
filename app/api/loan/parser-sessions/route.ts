import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextId } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const db = await getDb();
  const rows = await db.collection('parser_sessions')
    .find({}, { projection: { _id: 0 } })
    .sort({ saved_at: -1 })
    .toArray();
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { label, rows_data, sum_bet, sum_result, profit } = body;
  if (!rows_data || !Array.isArray(rows_data) || rows_data.length === 0) {
    return NextResponse.json({ error: 'rows_data is required' }, { status: 400 });
  }

  const db = await getDb();
  const id = await nextId('parser_sessions');
  await db.collection('parser_sessions').insertOne({
    id,
    label: label ?? null,
    rows_data,
    sum_bet: sum_bet ?? 0,
    sum_result: sum_result ?? 0,
    profit: profit ?? 0,
    saved_by: user.userId,
    saved_at: new Date().toISOString(),
  });
  return NextResponse.json({ id }, { status: 201 });
}
