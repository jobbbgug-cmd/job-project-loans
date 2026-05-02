import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function getUserId(request: NextRequest): Promise<number | null> {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.userId ?? null;
}

type TodoRow = { id: number; title: string; completed: number; created_at: string };

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.execute(
      'SELECT id FROM todos WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if ((existing as unknown[]).length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const sets: string[] = [];
    const values: (string | number)[] = [];

    if (body.completed !== undefined) {
      sets.push('completed = ?');
      values.push(body.completed ? 1 : 0);
    }
    if (body.title !== undefined) {
      sets.push('title = ?');
      values.push(body.title.trim());
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    await conn.execute(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`, values);

    const [rows] = await conn.execute(
      'SELECT id, title, completed, created_at FROM todos WHERE id = ?',
      [id]
    );
    const row = (rows as TodoRow[])[0];
    return NextResponse.json({ ...row, completed: !!row.completed });
  } finally {
    conn.release();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'DELETE FROM todos WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } finally {
    conn.release();
  }
}
