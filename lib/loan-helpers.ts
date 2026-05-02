import pool from './loan-db';
import type { PoolConnection } from 'mysql2/promise';

// ─── Loan calculation ────────────────────────────────────────────────────────

export function calcMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (annualRate === 0) return principal / termMonths;
  const r = annualRate / 100 / 12;
  const payment = (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
  return Math.round(payment * 100) / 100;
}

export interface ScheduleRow {
  installment_no: number;
  due_date: string;
  principal_component: number;
  interest_component: number;
  due_amount: number;
  outstanding_balance: number;
}

export function buildSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  monthlyPayment: number,
  startDate: Date
): ScheduleRow[] {
  const r = annualRate / 100 / 12;
  const rows: ScheduleRow[] = [];
  let balance = principal;

  for (let i = 1; i <= termMonths; i++) {
    const interest = Math.round(balance * r * 100) / 100;
    let principalComp = Math.round((monthlyPayment - interest) * 100) / 100;

    // Final instalment: clear remaining balance
    if (i === termMonths) {
      principalComp = Math.round(balance * 100) / 100;
    }

    balance = Math.max(0, Math.round((balance - principalComp) * 100) / 100);

    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    rows.push({
      installment_no: i,
      due_date: dueDate.toISOString().split('T')[0],
      principal_component: principalComp,
      interest_component: interest,
      due_amount: Math.round((principalComp + interest) * 100) / 100,
      outstanding_balance: balance,
    });
  }

  return rows;
}

// ─── Loan number generator ───────────────────────────────────────────────────

export async function generateLoanNumber(conn: PoolConnection): Promise<string> {
  const year = new Date().getFullYear();
  const [rows] = await conn.execute(
    'SELECT COUNT(*) AS cnt FROM loans WHERE YEAR(created_at) = ?',
    [year]
  );
  const count = ((rows as { cnt: number }[])[0].cnt ?? 0) + 1;
  return `LN-${year}-${String(count).padStart(5, '0')}`;
}

// ─── Audit logger ────────────────────────────────────────────────────────────

export async function audit(
  userId: number | null,
  action: string,
  entityType: string | null,
  entityId: number | null,
  details: object,
  ip?: string
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, action, entityType, entityId, JSON.stringify(details), ip ?? null]
    );
  } finally {
    conn.release();
  }
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

export { pool };
