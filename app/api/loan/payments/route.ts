import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextId } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { audit, generatePaymentNumber } from '@/lib/loan-helpers';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const loanId = searchParams.get('loan_id');
  const status = searchParams.get('status');

  const db = await getDb();
  const pipeline: object[] = [];

  const initialMatch: Record<string, unknown> = {};
  if (loanId) initialMatch.loan_id = Number(loanId);
  if (status) initialMatch.status = status;
  if (Object.keys(initialMatch).length) pipeline.push({ $match: initialMatch });

  pipeline.push(
    { $lookup: { from: 'loans', localField: 'loan_id', foreignField: 'id', as: 'loan' } },
    { $unwind: '$loan' },
  );
  if (user.role === 'customer') {
    pipeline.push({ $match: { 'loan.customer_id': user.userId } });
  }
  pipeline.push(
    { $lookup: { from: 'users', localField: 'loan.customer_id', foreignField: 'id', as: 'customer' } },
    { $unwind: '$customer' },
    { $lookup: { from: 'users', localField: 'verified_by', foreignField: 'id', as: 'verifier' } },
    { $unwind: { path: '$verifier', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'payment_schedule', localField: 'schedule_id', foreignField: 'id', as: 'schedule' } },
    { $unwind: { path: '$schedule', preserveNullAndEmptyArrays: true } },
    { $addFields: {
      loan_number: '$loan.loan_number',
      customer_name: '$customer.name',
      verifier_name: '$verifier.name',
      installment_no: '$schedule.installment_no',
      due_date: '$schedule.due_date',
      loan_principal: '$loan.principal',
      loan_paid_amount: '$loan.paid_amount',
      loan_term_months: '$loan.term_months',
    } },
    { $project: { _id: 0, loan: 0, customer: 0, verifier: 0, schedule: 0 } },
    { $sort: { created_at: -1 } },
  );

  const rows = await db.collection('payments').aggregate(pipeline).toArray();
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const loanId      = formData.get('loan_id') as string;
  const scheduleId  = formData.get('schedule_id') as string | null;
  const amount      = formData.get('amount') as string;
  const paymentDate = formData.get('payment_date') as string;
  const notes       = formData.get('notes') as string | null;
  const slip        = formData.get('slip') as File | null;

  if (!loanId || !amount || !paymentDate) {
    return NextResponse.json({ error: 'loan_id, amount and payment_date are required' }, { status: 400 });
  }

  const db = await getDb();
  const loan = await db.collection('loans').findOne({ id: Number(loanId) });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  if (['completed', 'rejected', 'defaulted'].includes(loan.status as string)) {
    return NextResponse.json({ error: `Cannot record payment for a ${loan.status} loan` }, { status: 400 });
  }
  if (user.role === 'customer' && loan.customer_id !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let slipFilename: string | null = null;
  let slipPath: string | null = null;
  if (slip && slip.size > 0) {
    const ext = slip.name.split('.').pop() ?? 'jpg';
    slipFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    try {
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob');
        const { url } = await put(`slips/${slipFilename}`, slip, { access: 'public' });
        slipPath = url;
      } else {
        const { writeFile, mkdir } = await import('fs/promises');
        const { join } = await import('path');
        const dir = join(process.cwd(), 'public', 'uploads', 'slips');
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, slipFilename), Buffer.from(await slip.arrayBuffer()));
        slipPath = `/uploads/slips/${slipFilename}`;
      }
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // For open-ended loans (term_months=0), auto-create a schedule entry
  let finalScheduleId: number | null = scheduleId ? Number(scheduleId) : null;
  if (loan.term_months === 0 && !scheduleId) {
    const count = await db.collection('payment_schedule').countDocuments({ loan_id: Number(loanId) });
    const schedId = await nextId('payment_schedule');
    await db.collection('payment_schedule').insertOne({
      id: schedId,
      loan_id: Number(loanId),
      installment_no: count + 1,
      due_date: paymentDate,
      principal_component: Number(amount),
      interest_component: 0,
      due_amount: Number(amount),
      outstanding_balance: 0,
      status: 'pending',
      paid_date: null,
    });
    finalScheduleId = schedId;
  }

  // Check if payment is late
  let isLate = false;
  if (finalScheduleId && loan.term_months !== 0) {
    const sched = await db.collection('payment_schedule').findOne({ id: finalScheduleId });
    if (sched && new Date(paymentDate) > new Date(sched.due_date as string)) isLate = true;
  }

  const paymentNumber = await generatePaymentNumber();
  const newId = await nextId('payments');
  await db.collection('payments').insertOne({
    id: newId,
    payment_number: paymentNumber,
    loan_id: Number(loanId),
    schedule_id: finalScheduleId,
    paid_by: user.userId,
    amount: Number(amount),
    payment_date: paymentDate,
    slip_filename: slipFilename,
    slip_path: slipPath,
    notes: notes ?? null,
    is_late: isLate,
    status: 'pending',
    verified_by: null,
    verified_at: null,
    rejection_reason: null,
    created_at: new Date().toISOString(),
  });
  await audit(user.userId, 'RECORD_PAYMENT', 'payment', newId, { loanId, amount, paymentNumber });
  return NextResponse.json({ id: newId, payment_number: paymentNumber, status: 'pending', slip_path: slipPath }, { status: 201 });
}
