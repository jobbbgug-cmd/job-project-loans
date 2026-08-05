import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextId } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { audit, calcMonthlyPayment, buildSchedule } from '@/lib/loan-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const db = await getDb();

  const loan = await db.collection('loans').aggregate([
    { $match: { id: Number(id) } },
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
    { $lookup: {
      from: 'payments',
      let: { loanId: '$id' },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$loan_id', '$$loanId'] }, { $eq: ['$status', 'approved'] }, { $in: ['$payment_type', ['principal', 'interest']] }] } } },
        { $group: { _id: '$payment_type', total: { $sum: '$amount' } } },
      ],
      as: 'payment_type_agg',
    } },
    { $addFields: {
      customer_name: '$customer.name',
      customer_email: '$customer.email',
      customer_phone: '$customer.phone',
      staff_name: '$staff.name',
      paid_amount: { $ifNull: [{ $arrayElemAt: ['$paid_agg.total', 0] }, 0] },
      principal_paid: {
        $let: {
          vars: {
            schedPrincipal: { $ifNull: [{ $arrayElemAt: ['$schedule_agg.principal', 0] }, 0] },
            paymentPrincipal: {
              $reduce: {
                input: '$payment_type_agg',
                initialValue: 0,
                in: { $cond: [{ $eq: ['$$this._id', 'principal'] }, { $add: ['$$value', '$$this.total'] }, '$$value'] }
              }
            }
          },
          in: { $add: ['$$schedPrincipal', '$$paymentPrincipal'] }
        }
      },
      interest_paid: {
        $let: {
          vars: {
            schedInterest: { $ifNull: [{ $arrayElemAt: ['$schedule_agg.interest', 0] }, 0] },
            paymentInterest: {
              $reduce: {
                input: '$payment_type_agg',
                initialValue: 0,
                in: { $cond: [{ $eq: ['$$this._id', 'interest'] }, { $add: ['$$value', '$$this.total'] }, '$$value'] }
              }
            }
          },
          in: { $add: ['$$schedInterest', '$$paymentInterest'] }
        }
      },
    } },
    { $project: { _id: 0, customer: 0, staff: 0, paid_agg: 0, schedule_agg: 0, payment_type_agg: 0 } },
  ]).next();

  if (!loan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (user.role === 'customer' && (loan as { customer_id: number }).customer_id !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(loan);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user || !['admin', 'staff'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();

  const { customer_id, principal, interest_rate, term_months, start_date, purpose, notes, custom_schedule } = body;
  if (!customer_id || !principal || interest_rate === undefined || term_months === undefined || !start_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (Number(principal) <= 0 || Number(interest_rate) < 0 || Number(term_months) < 0) {
    return NextResponse.json({ error: 'Invalid loan parameters' }, { status: 400 });
  }

  const isOpenEnded = Number(term_months) === 0;
  type CustomRow = { installment_no: number; interest_component: number; principal_component: number };
  const customSchedule: CustomRow[] | null = (!isOpenEnded && Array.isArray(custom_schedule)) ? custom_schedule as CustomRow[] : null;

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

  const loanStart = new Date(start_date);
  const loanEnd   = isOpenEnded ? null : new Date(loanStart);
  if (loanEnd) loanEnd.setMonth(loanEnd.getMonth() + Number(term_months));

  const db = await getDb();
  await db.collection('loans').updateOne(
    { id: Number(id) },
    { $set: {
      customer_id, principal, interest_rate, term_months,
      monthly_payment: monthlyPayment, total_payment: totalPayment, total_interest: totalInterest,
      start_date: loanStart.toISOString().split('T')[0],
      end_date: loanEnd ? loanEnd.toISOString().split('T')[0] : null,
      purpose: purpose || null, notes: notes || null,
    } }
  );

  await db.collection('payment_schedule').deleteMany({ loan_id: Number(id) });

  if (!isOpenEnded) {
    const loanIdNum = Number(id);
    if (customSchedule && customSchedule.length === Number(term_months)) {
      let balance = Number(principal);
      for (const row of customSchedule) {
        const pc = Math.round(row.principal_component * 100) / 100;
        const ic = Math.round(row.interest_component * 100) / 100;
        balance  = Math.max(0, Math.round((balance - pc) * 100) / 100);
        const dd = new Date(loanStart);
        dd.setMonth(dd.getMonth() + row.installment_no);

        // Retry loop to handle duplicate id
        let inserted = false;
        for (let attempts = 0; attempts < 5; attempts++) {
          const schedId = await nextId('payment_schedule');
          try {
            await db.collection('payment_schedule').insertOne({
              id: schedId, loan_id: loanIdNum, installment_no: row.installment_no,
              due_date: dd.toISOString().split('T')[0],
              principal_component: pc, interest_component: ic,
              due_amount: Math.round((pc + ic) * 100) / 100,
              outstanding_balance: balance, status: 'pending', paid_date: null,
            });
            inserted = true;
            break;
          } catch (err: any) {
            if (err.code === 11000) continue;
            throw err;
          }
        }
        if (!inserted) throw new Error('Failed to create schedule entry');
      }
    } else {
      const schedule = buildSchedule(Number(principal), Number(interest_rate), Number(term_months), monthlyPayment, loanStart);
      for (const row of schedule) {
        // Retry loop to handle duplicate id
        let inserted = false;
        for (let attempts = 0; attempts < 5; attempts++) {
          const schedId = await nextId('payment_schedule');
          try {
            await db.collection('payment_schedule').insertOne({
              id: schedId, loan_id: loanIdNum, ...row, status: 'pending', paid_date: null,
            });
            inserted = true;
            break;
          } catch (err: any) {
            if (err.code === 11000) continue;
            throw err;
          }
        }
        if (!inserted) throw new Error('Failed to create schedule entry');
      }
    }
  }

  await audit(user.userId, 'UPDATE_LOAN', 'loan', Number(id), body);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const db = await getDb();

  const loan = await db.collection('loans').findOne({ id: Number(id) });
  if (!loan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await Promise.all([
    db.collection('payments').deleteMany({ loan_id: Number(id) }),
    db.collection('payment_schedule').deleteMany({ loan_id: Number(id) }),
    db.collection('loan_documents').deleteMany({ loan_id: Number(id) }),
    db.collection('loans').deleteOne({ id: Number(id) }),
  ]);
  await audit(user.userId, 'DELETE_LOAN', 'loan', Number(id), {});
  return NextResponse.json({ success: true });
}
