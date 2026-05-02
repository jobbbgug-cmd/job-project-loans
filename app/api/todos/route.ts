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

function normalizeTodo(row: TodoRow) {
  return { ...row, completed: !!row.completed };
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT id, title, completed, created_at FROM todos WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return NextResponse.json((rows as TodoRow[]).map(normalizeTodo));
  } finally {
    conn.release();
  }
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title } = await request.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'INSERT INTO todos (user_id, title) VALUES (?, ?)',
      [userId, title.trim()]
    );
    const id = (result as { insertId: number }).insertId;
    const [rows] = await conn.execute(
      'SELECT id, title, completed, created_at FROM todos WHERE id = ?',
      [id]
    );
    return NextResponse.json(normalizeTodo((rows as TodoRow[])[0]), { status: 201 });
  } finally {
    conn.release();
  }
}
