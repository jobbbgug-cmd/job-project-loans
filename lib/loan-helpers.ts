import { getDb, nextId } from './loan-db';

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
    if (i === termMonths) principalComp = Math.round(balance * 100) / 100;
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

// ─── Number generators (use counters collection) ─────────────────────────────

export async function generateLoanNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const db = await getDb();
  const res = await db
    .collection<{ _id: string; seq: number }>('counters')
    .findOneAndUpdate(
      { _id: `loan_num_${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
  return `LN-${year}-${String(res!.seq).padStart(5, '0')}`;
}

export async function generatePaymentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const db = await getDb();
  const res = await db
    .collection<{ _id: string; seq: number }>('counters')
    .findOneAndUpdate(
      { _id: `pay_num_${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
  return `PAY-${year}-${String(res!.seq).padStart(5, '0')}`;
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
  try {
    const db = await getDb();
    const id = await nextId('audit_logs');
    await db.collection('audit_logs').insertOne({
      id,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: ip ?? null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Audit failures must not break the main flow
  }
}
