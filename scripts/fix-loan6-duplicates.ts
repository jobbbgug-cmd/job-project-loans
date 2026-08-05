import { getDb } from '../lib/loan-db';

async function fixLoan6Duplicates() {
  const db = await getDb();

  console.log('Checking payment_schedule for loan 6...');
  const schedules = await db.collection('payment_schedule')
    .find({ loan_id: 6 })
    .sort({ id: 1, installment_no: 1 })
    .toArray();

  console.log(`Found ${schedules.length} schedule records`);

  // Find duplicate IDs
  const idMap: Record<number, any[]> = {};
  schedules.forEach(s => {
    if (!idMap[s.id]) idMap[s.id] = [];
    idMap[s.id].push(s);
  });

  const dupes = Object.entries(idMap).filter(([, records]) => records.length > 1);
  if (dupes.length === 0) {
    console.log('No duplicate IDs found');
    return;
  }

  console.log(`\nFound ${dupes.length} duplicate IDs:`);
  for (const [id, records] of dupes) {
    console.log(`\n  ID ${id}: ${records.length} records`);
    records.forEach((r, idx) => {
      console.log(`    [${idx}] Installment ${r.installment_no}, Status: ${r.status}`);
    });

    // Keep the one with status='paid', delete others
    const paidRecord = records.find(r => r.status === 'paid');
    const toDelete = records.filter(r => r !== paidRecord);

    if (toDelete.length > 0) {
      console.log(`    → Keeping record with status='paid', deleting ${toDelete.length} duplicates`);
      for (const record of toDelete) {
        await db.collection('payment_schedule').deleteOne({ _id: record._id });
        console.log(`      ✓ Deleted installment_no=${record.installment_no}`);
      }
    }
  }

  console.log('\n✅ Done');
}

fixLoan6Duplicates().catch(console.error).then(() => process.exit(0));
