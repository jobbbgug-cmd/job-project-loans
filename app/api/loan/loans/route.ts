import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';
import { calcMonthlyPayment, buildSchedule, generateLoanNumber, audit } from '@/lib/loan-helpers';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const conn = await pool.getConnection();
  try {
    let sql = `SELECT l.*, u.name AS customer_name, u.email AS customer_email,
               s.name AS staff_name,
               (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.loan_id = l.id AND p.status = 'approved') AS paid_amount
               FROM loans l
               JOIN users u ON l.customer_id = u.id
               LEFT JOIN users s ON l.staff_id = s.id`;
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    if (user.role === 'customer') { conditions.push('l.customer_id = ?'); params.push(user.userId); }
    if (status) { conditions.push('l.status = ?'); params.push(status); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY l.created_at DESC';
    const [rows] = await conn.execute(sql, params);
    return NextResponse.json(rows);
  } finally { conn.release(); }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || !['admin', 'staff'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { customer_id, principal, interest_rate, term_months, start_date, purpose, notes } = await request.json();
  if (!customer_id || !principal || !interest_rate || !term_months) {
    return NextResponse.json({ error: 'customer_id, principal, interest_rate and term_months are required' }, { status: 400 });
  }
  if (principal <= 0 || interest_rate < 0 || term_months <= 0) {
    return NextResponse.json({ error: 'Invalid loan parameters' }, { status: 400 });
  }

  const monthlyPayment = calcMonthlyPayment(Number(principal), Number(interest_rate), Number(term_months));
  const totalPayment = Math.round(monthlyPayment * term_months * 100) / 100;
  const totalInterest = Math.round((totalPayment - Number(principal)) * 100) / 100;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const loanNumber = await generateLoanNumber(conn);
    const loanStart = start_date ? new Date(start_date) : new Date();
    const loanEnd = new Date(loanStart);
    loanEnd.setMonth(loanEnd.getMonth() + Number(term_months));

    const [result] = await conn.execute(
      `INSERT INTO loans (loan_number, customer_id, staff_id, principal, interest_rate, term_months,
        monthly_payment, total_payment, total_interest, status, start_date, end_date, purpose, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [loanNumber, customer_id, user.userId, principal, interest_rate, term_months,
       monthlyPayment, totalPayment, totalInterest,
       loanStart.toISOString().split('T')[0], loanEnd.toISOString().split('T')[0],
       purpose ?? null, notes ?? null]
    );
    const loanId = (result as { insertId: number }).insertId;

    const schedule = buildSchedule(Number(principal), Number(interest_rate), Number(term_months), monthlyPayment, loanStart);
    for (const row of schedule) {
      await conn.execute(
        `INSERT INTO payment_schedule (loan_id, installment_no, due_date, principal_component,
         interest_component, due_amount, outstanding_balance) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [loanId, row.installment_no, row.due_date, row.principal_component,
         row.interest_component, row.due_amount, row.outstanding_balance]
      );
    }

    await conn.commit();
    await audit(user.userId, 'CREATE_LOAN', 'loan', loanId, { loanNumber, principal, interest_rate, term_months });
    return NextResponse.json({ id: loanId, loan_number: loanNumber, monthly_payment: monthlyPayment, total_payment: totalPayment }, { status: 201 });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
}
