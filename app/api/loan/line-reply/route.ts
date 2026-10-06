import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextId } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId, message } = await request.json() as { userId: string; message: string };
  if (!userId || !message) {
    return NextResponse.json({ error: 'userId and message required' }, { status: 400 });
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN not set');
    return NextResponse.json({ error: 'LINE channel not configured' }, { status: 500 });
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: message }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('LINE API error:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 400 });
    }

    // Save outgoing message to database
    try {
      const db = await getDb();
      const msgId = await nextId('line_messages');
      await db.collection('line_messages').insertOne({
        id: msgId,
        line_user_id: userId,
        display_name: 'Bot',
        message: message,
        received_at: new Date().toISOString(),
        used: true,
        type: 'outgoing', // Mark as outgoing
      });
    } catch (dbErr) {
      console.error('Failed to save outgoing message:', dbErr);
      // Don't fail the response if DB save fails, message already sent to LINE
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error sending LINE message:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
