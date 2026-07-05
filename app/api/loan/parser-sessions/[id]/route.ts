import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: idStr } = await params;
  const id = Number(idStr);
  const body = await request.json();
  const { label } = body;

  if (label === undefined) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection('parser_sessions').updateOne(
    { id },
    { $set: { label } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
