import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(_req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT d.id, d.file_name, d.file_path, d.created_at, u.name AS uploaded_by_name
       FROM loan_documents d JOIN users u ON d.uploaded_by = u.id
       WHERE d.loan_id = ? ORDER BY d.created_at DESC`,
      [id]
    );
    return NextResponse.json(rows);
  } finally { conn.release(); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const { writeFile, mkdir } = await import('fs/promises');
  const { join } = await import('path');
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const dir = join(process.cwd(), 'public', 'uploads', 'loans', id);
  await mkdir(dir, { recursive: true });
  const ext = file.name.split('.').pop() ?? 'bin';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await writeFile(join(dir, fileName), buffer);
  const filePath = `/uploads/loans/${id}/${fileName}`;

  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'INSERT INTO loan_documents (loan_id, file_name, file_path, uploaded_by) VALUES (?, ?, ?, ?)',
      [id, file.name, filePath, user.userId]
    );
    const newId = (result as { insertId: number }).insertId;
    return NextResponse.json({ id: newId, file_name: file.name, file_path: filePath }, { status: 201 });
  } finally { conn.release(); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user || !['admin', 'staff'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('doc_id');
  if (!docId) return NextResponse.json({ error: 'doc_id required' }, { status: 400 });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT file_path FROM loan_documents WHERE id = ? AND loan_id = ?', [docId, id]);
    const docs = rows as { file_path: string }[];
    if (docs.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { unlink } = await import('fs/promises');
    const { join } = await import('path');
    await unlink(join(process.cwd(), 'public', docs[0].file_path)).catch(() => {});
    await conn.execute('DELETE FROM loan_documents WHERE id = ?', [docId]);
    return NextResponse.json({ success: true });
  } finally { conn.release(); }
}
