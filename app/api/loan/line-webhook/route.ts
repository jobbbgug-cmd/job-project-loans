import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, nextId } from '@/lib/loan-db';

interface LineTextMessage { type: 'text'; text: string; }
interface LineEvent {
  type: string;
  message?: LineTextMessage;
  source?: { userId?: string };
}
interface LineWebhookBody {
  events: LineEvent[];
}

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const hash = crypto.createHmac('SHA256', secret).update(body).digest('base64');
  return hash === signature;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-line-signature') ?? '';

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: LineWebhookBody;
  try { body = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = await getDb();
  for (const event of body.events) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue;
    const text = event.message.text.trim();
    if (!text) continue;
    const userId = event.source?.userId ?? null;

    let displayName: string | null = null;
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (token && userId) {
      try {
        const r = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) { const p = await r.json(); displayName = p.displayName ?? null; }
      } catch { /* ignore */ }
    }

    const msgId = await nextId('line_messages');
    await db.collection('line_messages').insertOne({
      id: msgId,
      line_user_id: userId,
      display_name: displayName,
      message: text,
      used: false,
      received_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
