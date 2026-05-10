/**
 * Migrate MySQL (XAMPP/loan_app) → MongoDB Atlas (money-project)
 * Run: node scripts/mysql-to-mongo.js
 */

const { MongoClient } = require('mongodb');
const { execSync } = require('child_process');

const MYSQL = '/Applications/XAMPP/bin/mysql';
const ATLAS_URI = 'mongodb+srv://jobbbgug_db_user:12gykXFWSJt8enuv@money-project.2vp3zny.mongodb.net/?appName=money-project';
const MONGO_DB = 'money-project';
const MYSQL_DB = 'loan_app';

// Integer fields per collection
const INT_FIELDS = {
  roles:            ['id'],
  users:            ['id', 'role_id', 'is_active'],
  loans:            ['id', 'customer_id', 'staff_id', 'term_months'],
  payment_schedule: ['id', 'loan_id', 'installment_no'],
  payments:         ['id', 'loan_id', 'verified_by'],
  audit_logs:       ['id', 'user_id', 'record_id'],
  loan_documents:   ['id', 'loan_id', 'uploaded_by'],
  line_messages:    ['id', 'user_id'],
  parser_sessions:  ['id', 'user_id'],
};

// Decimal fields per collection
const DECIMAL_FIELDS = {
  loans:            ['principal', 'interest_rate', 'monthly_payment', 'total_payment', 'total_interest', 'paid_amount'],
  payment_schedule: ['principal_component', 'interest_component', 'due_amount', 'outstanding_balance', 'paid_amount'],
  payments:         ['amount'],
};

function castRow(table, row) {
  const intFields    = INT_FIELDS[table]     || [];
  const decimalFields = DECIMAL_FIELDS[table] || [];
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null) {
      out[k] = null;
    } else if (intFields.includes(k)) {
      out[k] = parseInt(v, 10);
    } else if (decimalFields.includes(k)) {
      out[k] = parseFloat(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function queryMySQL(table) {
  try {
    const out = execSync(
      `${MYSQL} -u root --batch -e "SELECT * FROM ${table}" ${MYSQL_DB} 2>/dev/null`
    ).toString().trim();
    if (!out) return [];
    const lines = out.split('\n');
    const headers = lines[0].split('\t');
    return lines.slice(1).map(line => {
      const vals = line.split('\t');
      const obj = {};
      headers.forEach((h, i) => {
        const v = vals[i];
        obj[h] = (v === 'NULL' || v === undefined) ? null : v;
      });
      return castRow(table, obj);
    });
  } catch (e) {
    console.error(`  MySQL query failed for ${table}:`, e.message);
    return [];
  }
}

async function migrate() {
  const client = new MongoClient(ATLAS_URI);
  await client.connect();
  const db = client.db(MONGO_DB);

  const tables = [
    'roles',
    'users',
    'loans',
    'payment_schedule',
    'payments',
    'audit_logs',
    'loan_documents',
    'line_messages',
  ];

  for (const table of tables) {
    const rows = queryMySQL(table);
    if (rows.length === 0) {
      console.log(`${table}: ไม่มีข้อมูล ข้าม`);
      continue;
    }

    // Drop collection (ล้าง index เก่าด้วย) แล้วสร้างใหม่
    try { await db.collection(table).drop(); } catch (_) {}

    await db.collection(table).insertMany(rows);
    console.log(`${table}: migrate ${rows.length} records สำเร็จ`);
  }

  // Re-create indexes
  await db.collection('users').createIndexes([
    { key: { email: 1 }, unique: true, sparse: true },
    { key: { id: 1 }, unique: true, sparse: true },
    { key: { role_id: 1 } },
  ]);
  await db.collection('loans').createIndexes([
    { key: { id: 1 }, unique: true, sparse: true },
    { key: { loan_number: 1 }, unique: true, sparse: true },
    { key: { customer_id: 1 } },
    { key: { status: 1 } },
  ]);
  await db.collection('payments').createIndexes([
    { key: { id: 1 }, unique: true, sparse: true },
    { key: { loan_id: 1 } },
    { key: { status: 1 } },
  ]);

  console.log('\nสร้าง indexes เสร็จแล้ว');
  await client.close();
  console.log('--- Migrate MySQL → MongoDB Atlas เสร็จสมบูรณ์ ---');
}

migrate().catch(e => console.error('Fatal:', e.message));
