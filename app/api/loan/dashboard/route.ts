import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conn = await pool.getConnection();
  try {
    const isCustomer = user.role === 'customer';
    const idFilter = isCustomer ? 'WHERE l.customer_id = ?' : '';
    const params: (string | number)[] = isCustomer ? [user.userId] : [];

    // Loan status summary
    const [loanStats] = await conn.execute(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(principal),0) AS total_principal
       FROM loans l ${idFilter} GROUP BY status`, params
    );

    // Total collected (approved payments)
    const [payStats] = await conn.execute(
      `SELECT COALESCE(SUM(p.amount),0) AS total_paid,
       COUNT(p.id) AS payment_count
       FROM payments p JOIN loans l ON p.loan_id = l.id
       ${idFilter ? idFilter + ' AND' : 'WHERE'} p.status = 'approved'`,
      isCustomer ? [user.userId] : []
    );

    // Outstanding balance (active loans)
    const [outstanding] = await conn.execute(
      `SELECT COALESCE(SUM(ps.outstanding_balance),0) AS outstanding
       FROM payment_schedule ps JOIN loans l ON ps.loan_id = l.id
       ${idFilter ? idFilter + ' AND' : 'WHERE'} l.status = 'active'
       AND ps.id = (SELECT MAX(id) FROM payment_schedule WHERE loan_id = l.id)`,
      isCustomer ? [user.userId] : []
    );

    // Pending payments count
    const [pendingPay] = await conn.execute(
      `SELECT COUNT(*) AS pending_payments FROM payments p
       JOIN loans l ON p.loan_id = l.id
       ${idFilter ? idFilter + ' AND' : 'WHERE'} p.status = 'pending'`,
      isCustomer ? [user.userId] : []
    );

    // Monthly income (last 6 months)
    const [monthly] = await conn.execute(
      `SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS month,
       COALESCE(SUM(p.amount),0) AS amount, COUNT(*) AS count
       FROM payments p JOIN loans l ON p.loan_id = l.id
       ${idFilter ? idFilter + ' AND' : 'WHERE'} p.status = 'approved'
       AND p.payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY month`,
      isCustomer ? [user.userId] : []
    );

    // Overdue installments
    const [overdue] = await conn.execute(
      `SELECT COUNT(*) AS overdue FROM payment_schedule ps
       JOIN loans l ON ps.loan_id = l.id
       ${idFilter ? idFilter + ' AND' : 'WHERE'} ps.due_date < CURDATE()
       AND ps.status NOT IN ('paid') AND l.status = 'active'`,
      isCustomer ? [user.userId] : []
    );

    return NextResponse.json({
      loan_stats: loanStats,
      total_paid: (payStats as { total_paid: number }[])[0]?.total_paid ?? 0,
      payment_count: (payStats as { payment_count: number }[])[0]?.payment_count ?? 0,
      outstanding_balance: (outstanding as { outstanding: number }[])[0]?.outstanding ?? 0,
      pending_payments: (pendingPay as { pending_payments: number }[])[0]?.pending_payments ?? 0,
      overdue_installments: (overdue as { overdue: number }[])[0]?.overdue ?? 0,
      monthly_income: monthly,
    });
  } finally { conn.release(); }
}
