import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextId } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(_req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const db = await getDb();
  const docs = await db.collection('loan_documents').aggregate([
    { $match: { loan_id: Number(id) } },
    { $lookup: { from: 'users', localField: 'uploaded_by', foreignField: 'id', as: 'uploader' } },
    { $unwind: { path: '$uploader', preserveNullAndEmptyArrays: true } },
    { $addFields: { uploaded_by_name: '$uploader.name' } },
    { $project: { _id: 0, uploader: 0 } },
    { $sort: { created_at: -1 } },
  ]).toArray();
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const ext = file.name.split('.').pop() ?? 'bin';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    let filePath: string;

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token) {
      const { put } = await import('@vercel/blob');
      const { url } = await put(`loans/${id}/${uniqueName}`, file, { access: 'private', token });
      filePath = url;
    } else {
      const { writeFile, mkdir } = await import('fs/promises');
      const { join } = await import('path');
      const dir = join(process.cwd(), 'public', 'uploads', 'loans', id);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, uniqueName), Buffer.from(await file.arrayBuffer()));
      filePath = `/uploads/loans/${id}/${uniqueName}`;
    }

    const db = await getDb();
    const docId = await nextId('loan_documents');
    await db.collection('loan_documents').insertOne({
      id: docId, loan_id: Number(id), file_name: file.name,
      file_path: filePath, uploaded_by: user.userId, created_at: new Date().toISOString(),
    });
    return NextResponse.json({ id: docId, file_name: file.name, file_path: filePath }, { status: 201 });
  } catch (err) {
    console.error('upload error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user || !['admin', 'staff'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('doc_id');
  if (!docId) return NextResponse.json({ error: 'doc_id required' }, { status: 400 });

  const db = await getDb();
  const doc = await db.collection('loan_documents').findOne({ id: Number(docId), loan_id: Number(id) });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { del } = await import('@vercel/blob');
  await del(doc.file_path as string).catch(() => {});
  await db.collection('loan_documents').deleteOne({ id: Number(docId) });
  return NextResponse.json({ success: true });
}
