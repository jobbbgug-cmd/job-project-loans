import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'raw' or 'amount'

  const db = await getDb();

  // Get all khanchit messages (both incoming and outgoing)
  const messages = await db.collection('line_messages')
    .find({ display_name: 'khanchit' }, {
      projection: { _id: 0, id: 1, message: 1, received_at: 1, type: 1 }
    })
    .sort({ received_at: -1 })
    .toArray();

  // Filter based on message pattern
  const filtered = messages.filter(msg => {
    if (!msg.message) return false;

    if (type === 'raw') {
      // Raw data: contains "/" (handicap/odds pattern) - e.g., "เซลติก 0.5-1/1.78(1-2)"
      return msg.message.includes('/') && !msg.message.includes('=');
    } else if (type === 'amount') {
      // Amount data: contains "=" - e.g., "ต่อเซลติก=200"
      return msg.message.includes('=');
    }

    return true;
  });

  return NextResponse.json(filtered);
}
