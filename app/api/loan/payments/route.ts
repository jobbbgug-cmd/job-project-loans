import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const loanId = searchParams.get('loan_id');
  const status = searchParams.get('status');
  const conn = await pool.getConnection();
  try {
    let sql = `SELECT p.*, l.loan_number, u.name AS customer_name,
               v.name AS verifier_name, ps.installment_no, ps.due_date
               FROM payments p
               JOIN loans l ON p.loan_id = l.id
               JOIN users u ON p.paid_by = u.id
               LEFT JOIN users v ON p.verified_by = v.id
               LEFT JOIN payment_schedule ps ON p.schedule_id = ps.id`;
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (user.role === 'customer') { conditions.push('l.customer_id = ?'); params.push(user.userId); }
    if (loanId) { conditions.push('p.loan_id = ?'); params.push(loanId); }
    if (status) { conditions.push('p.status = ?'); params.push(status); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY p.created_at DESC';
    const [rows] = await conn.execute(sql, params);
    return NextResponse.json(rows);
  } finally { conn.release(); }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const loanId    = formData.get('loan_id') as string;
  const scheduleId = formData.get('schedule_id') as string | null;
  const amount    = formData.get('amount') as string;
  const paymentDate = formData.get('payment_date') as string;
  const notes     = formData.get('notes') as string | null;
  const slip      = formData.get('slip') as File | null;

  if (!loanId || !amount || !paymentDate) {
    return NextResponse.json({ error: 'loan_id, amount and payment_date are required' }, { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    const [loanRows] = await conn.execute('SELECT customer_id, status FROM loans WHERE id = ?', [loanId]);
    const loans = loanRows as { customer_id: number; status: string }[];
    if (loans.length === 0) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    if (['completed', 'rejected', 'defaulted'].includes(loans[0].status)) return NextResponse.json({ error: 'Cannot record payment for a ' + loans[0].status + ' loan' }, { status: 400 });
    if (user.role === 'customer' && loans[0].customer_id !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let slipFilename: string | null = null;
    let slipPath: string | null = null;

    if (slip && slip.size > 0) {
      const { writeFile, mkdir } = await import('fs/promises');
      const { join } = await import('path');
      const bytes = await slip.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const dir = join(process.cwd(), 'public', 'uploads', 'slips');
      await mkdir(dir, { recursive: true });
      const ext = slip.name.split('.').pop() ?? 'jpg';
      slipFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      await writeFile(join(dir, slipFilename), buffer);
      slipPath = `/uploads/slips/${slipFilename}`;
    }

    // Check if payment is late
    let isLate = 0;
    if (scheduleId) {
      const [sched] = await conn.execute('SELECT due_date FROM payment_schedule WHERE id = ?', [scheduleId]);
      const schedRows = sched as { due_date: string }[];
      if (schedRows.length > 0 && new Date(paymentDate) > new Date(schedRows[0].due_date)) isLate = 1;
    }

    const [result] = await conn.execute(
      `INSERT INTO payments (loan_id, schedule_id, paid_by, amount, payment_date, slip_filename, slip_path, notes, is_late)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [loanId, scheduleId ?? null, user.userId, amount, paymentDate, slipFilename, slipPath, notes ?? null, isLate]
    );
    const newId = (result as { insertId: number }).insertId;
    await audit(user.userId, 'RECORD_PAYMENT', 'payment', newId, { loanId, amount });
    return NextResponse.json({ id: newId, status: 'pending', slip_path: slipPath }, { status: 201 });
  } finally { conn.release(); }
}
