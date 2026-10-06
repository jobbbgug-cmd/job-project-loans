import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/loan-db';
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error sending LINE message:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
