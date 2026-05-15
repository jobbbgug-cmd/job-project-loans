import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextId } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { calcMonthlyPayment, buildSchedule, generateLoanNumber, audit } from '@/lib/loan-helpers';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const db = await getDb();
  const matchStage: Record<string, unknown> = {};
  if (user.role === 'customer') matchStage.customer_id = user.userId;
  if (status) matchStage.status = status;

  const pipeline: object[] = [
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
    { $lookup: { from: 'users', localField: 'customer_id', foreignField: 'id', as: 'customer' } },
    { $unwind: '$customer' },
    { $lookup: { from: 'users', localField: 'staff_id', foreignField: 'id', as: 'staff' } },
    { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
    { $lookup: {
      from: 'payments',
      let: { loanId: '$id' },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$loan_id', '$$loanId'] }, { $eq: ['$status', 'approved'] }] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ],
      as: 'paid_agg',
    } },
    { $lookup: {
      from: 'payment_schedule',
      let: { loanId: '$id' },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$loan_id', '$$loanId'] }, { $eq: ['$status', 'paid'] }] } } },
        { $group: { _id: null, principal: { $sum: '$principal_component' }, interest: { $sum: '$interest_component' } } },
      ],
      as: 'schedule_agg',
    } },
    { $addFields: {
      customer_name: '$customer.name',
      customer_email: '$customer.email',
      staff_name: '$staff.name',
      paid_amount: { $ifNull: [{ $arrayElemAt: ['$paid_agg.total', 0] }, 0] },
      principal_paid: { $ifNull: [{ $arrayElemAt: ['$schedule_agg.principal', 0] }, 0] },
      interest_paid:  { $ifNull: [{ $arrayElemAt: ['$schedule_agg.interest', 0] }, 0] },
    } },
    { $project: { _id: 0, customer: 0, staff: 0, paid_agg: 0, schedule_agg: 0 } },
    { $sort: { created_at: -1 } },
  ];

  const loans = await db.collection('loans').aggregate(pipeline).toArray();
  return NextResponse.json(loans);
}

export async function POST(request: NextRequest) {
  try {
  const user = await getAuthUser(request);
  if (!user || !['admin', 'staff'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const customer_id     = formData.get('customer_id') as string;
  const principal       = formData.get('principal') as string;
  const interest_rate   = formData.get('interest_rate') as string;
  const term_months     = formData.get('term_months') as string;
  const start_date      = formData.get('start_date') as string | null;
  const purpose         = formData.get('purpose') as string | null;
  const notes           = formData.get('notes') as string | null;
  const slip            = formData.get('slip') as File | null;
  const customScheduleStr = formData.get('custom_schedule') as string | null;

  if (!customer_id || !principal || !interest_rate || term_months === null) {
    return NextResponse.json({ error: 'customer_id, principal, interest_rate and term_months are required' }, { status: 400 });
  }
  if (Number(principal) <= 0 || Number(interest_rate) < 0 || Number(term_months) < 0) {
    return NextResponse.json({ error: 'Invalid loan parameters' }, { status: 400 });
  }

  const isOpenEnded = Number(term_months) === 0;

  type CustomRow = { installment_no: number; interest_component: number; principal_component: number };
  let customSchedule: CustomRow[] | null = null;
  if (!isOpenEnded && customScheduleStr) {
    try { customSchedule = JSON.parse(customScheduleStr); } catch { customSchedule = null; }
  }

  let monthlyPayment: number;
  let totalPayment: number;
  let totalInterest: number;

  if (isOpenEnded) {
    monthlyPayment = 0; totalPayment = 0; totalInterest = 0;
  } else if (customSchedule && customSchedule.length === Number(term_months)) {
    totalInterest  = Math.round(customSchedule.reduce((s, r) => s + r.interest_component, 0) * 100) / 100;
    totalPayment   = Math.round((Number(principal) + totalInterest) * 100) / 100;
    monthlyPayment = Math.round((totalPayment / Number(term_months)) * 100) / 100;
  } else {
    monthlyPayment = calcMonthlyPayment(Number(principal), Number(interest_rate), Number(term_months));
    totalPayment   = Math.round(monthlyPayment * Number(term_months) * 100) / 100;
    totalInterest  = Math.round((totalPayment - Number(principal)) * 100) / 100;
  }

  const db = await getDb();
  const loanNumber = await generateLoanNumber();
  const loanStart  = start_date ? new Date(start_date) : new Date();
  const loanEnd    = isOpenEnded ? null : new Date(loanStart);
  if (loanEnd) loanEnd.setMonth(loanEnd.getMonth() + Number(term_months));

  const loanId = await nextId('loans');
  await db.collection('loans').insertOne({
    id: loanId,
    loan_number: loanNumber,
    customer_id: Number(customer_id),
    staff_id: user.userId,
    principal: Number(principal),
    interest_rate: Number(interest_rate),
    term_months: Number(term_months),
    monthly_payment: monthlyPayment,
    total_payment: totalPayment,
    total_interest: totalInterest,
    paid_amount: 0,
    status: 'pending',
    start_date: loanStart.toISOString().split('T')[0],
    end_date: loanEnd ? loanEnd.toISOString().split('T')[0] : null,
    purpose: purpose || null,
    notes: notes || null,
    created_at: new Date().toISOString(),
  });

  if (!isOpenEnded) {
    if (customSchedule && customSchedule.length === Number(term_months)) {
      let balance = Number(principal);
      for (const row of customSchedule) {
        const pc = Math.round(row.principal_component * 100) / 100;
        const ic = Math.round(row.interest_component * 100) / 100;
        balance  = Math.max(0, Math.round((balance - pc) * 100) / 100);
        const dd = new Date(loanStart);
        dd.setMonth(dd.getMonth() + row.installment_no);
        const schedId = await nextId('payment_schedule');
        await db.collection('payment_schedule').insertOne({
          id: schedId, loan_id: loanId, installment_no: row.installment_no,
          due_date: dd.toISOString().split('T')[0],
          principal_component: pc, interest_component: ic,
          due_amount: Math.round((pc + ic) * 100) / 100,
          outstanding_balance: balance, status: 'pending', paid_date: null,
        });
      }
    } else {
      const schedule = buildSchedule(Number(principal), Number(interest_rate), Number(term_months), monthlyPayment, loanStart);
      for (const row of schedule) {
        const schedId = await nextId('payment_schedule');
        await db.collection('payment_schedule').insertOne({
          id: schedId, loan_id: loanId, ...row, status: 'pending', paid_date: null,
        });
      }
    }
  }

  if (slip && slip.size > 0) {
    const ext = slip.name.split('.').pop() ?? 'bin';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    let fileUrl: string;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob');
      const { url } = await put(`loans/${loanId}/${uniqueName}`, slip, { access: 'private' as const });
      fileUrl = url;
    } else {
      const { writeFile, mkdir } = await import('fs/promises');
      const { join } = await import('path');
      const dir = join(process.cwd(), 'public', 'uploads', 'loans', String(loanId));
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, uniqueName), Buffer.from(await slip.arrayBuffer()));
      fileUrl = `/uploads/loans/${loanId}/${uniqueName}`;
    }
    const docId = await nextId('loan_documents');
    await db.collection('loan_documents').insertOne({
      id: docId, loan_id: loanId, file_name: slip.name,
      file_path: fileUrl, uploaded_by: user.userId, created_at: new Date().toISOString(),
    });
  }

  await audit(user.userId, 'CREATE_LOAN', 'loan', loanId, { loanNumber, principal, interest_rate, term_months });
  return NextResponse.json({ id: loanId, loan_number: loanNumber, monthly_payment: monthlyPayment, total_payment: totalPayment }, { status: 201 });
  } catch (err) {
    console.error('POST /api/loan/loans error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
