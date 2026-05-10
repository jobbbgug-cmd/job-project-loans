/**
 * MongoDB initialization script for loan_app
 * Run: node scripts/init-mongodb.js
 *
 * Creates indexes, initializes counters, and seeds an admin user.
 * Default admin credentials: admin@loanapp.com / Admin@1234
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'loan_app';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log(`Connected to MongoDB at ${uri}`);
  const db = client.db(dbName);

  // ── Indexes ────────────────────────────────────────────────────────────────
  await db.collection('users').createIndexes([
    { key: { email: 1 }, unique: true },
    { key: { id: 1 }, unique: true },
    { key: { role: 1 } },
  ]);

  await db.collection('loans').createIndexes([
    { key: { id: 1 }, unique: true },
    { key: { loan_number: 1 }, unique: true },
    { key: { customer_id: 1 } },
    { key: { status: 1 } },
  ]);

  await db.collection('payment_schedule').createIndexes([
    { key: { id: 1 }, unique: true },
    { key: { loan_id: 1 } },
    { key: { loan_id: 1, installment_no: 1 }, unique: true },
    { key: { due_date: 1, status: 1 } },
  ]);

  await db.collection('payments').createIndexes([
    { key: { id: 1 }, unique: true },
    { key: { loan_id: 1 } },
    { key: { status: 1 } },
    { key: { payment_number: 1 }, unique: true, sparse: true },
  ]);

  await db.collection('audit_logs').createIndexes([
    { key: { id: 1 }, unique: true },
    { key: { user_id: 1 } },
    { key: { created_at: -1 } },
  ]);

  await db.collection('loan_documents').createIndexes([
    { key: { id: 1 }, unique: true },
    { key: { loan_id: 1 } },
  ]);

  await db.collection('parser_sessions').createIndexes([
    { key: { id: 1 }, unique: true },
    { key: { saved_at: -1 } },
  ]);

  await db.collection('counters').createIndex({ _id: 1 });
  console.log('Indexes created');

  // ── Seed counters (start all at 0; nextId will $inc to 1 on first use) ────
  const counterNames = ['users', 'loans', 'payment_schedule', 'payments', 'audit_logs', 'loan_documents', 'parser_sessions'];
  for (const name of counterNames) {
    await db.collection('counters').updateOne(
      { _id: name },
      { $setOnInsert: { seq: 0 } },
      { upsert: true }
    );
  }
  console.log('Counters initialized');

  // ── Seed admin user ────────────────────────────────────────────────────────
  // Password: Admin@1234  (bcrypt, 12 rounds)
  const adminHash = '$2b$12$7BSzTxaohhQauPNqx2nybO.J.7/pcleYy7neQ5.GSS/vXX0/UOGDm';
  const existing = await db.collection('users').findOne({ email: 'admin@loanapp.com' });
  if (!existing) {
    // Get next user ID
    const counterRes = await db.collection('counters').findOneAndUpdate(
      { _id: 'users' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const adminId = counterRes.seq;
    await db.collection('users').insertOne({
      id: adminId,
      role: 'admin',
      name: 'System Admin',
      email: 'admin@loanapp.com',
      password_hash: adminHash,
      phone: null,
      address: null,
      id_number: null,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    console.log(`Admin user created (id=${adminId}): admin@loanapp.com / Admin@1234`);
  } else {
    console.log('Admin user already exists — skipped');
  }

  await client.close();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
