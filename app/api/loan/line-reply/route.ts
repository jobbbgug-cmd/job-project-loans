import { NextRequest, NextResponse } from 'next/server';
import { getDb, nextId } from '@/lib/loan-db';
import { getAuthUser } from '@/lib/loan-auth';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await request.formData();
  const userId = formData.get('userId') as string;
  const message = formData.get('message') as string | null;
  const file = formData.get('file') as File | null;

  if (!userId || (!message && !file)) {
    return NextResponse.json({ error: 'userId and (message or file) required' }, { status: 400 });
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN not set');
    return NextResponse.json({ error: 'LINE channel not configured' }, { status: 500 });
  }

  try {
    // Prepare messages array
    const messages: any[] = [];

    // Add text message if provided
    if (message?.trim()) {
      messages.push({ type: 'text', text: message });
    }

    // Handle image upload
    let imageDataUrl: string | null = null;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      // Store as base64 data URL for display
      imageDataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;

      // For LINE API, send as text for now (LINE requires external URL for images)
      // Store the data URL locally and it will be displayed in the chat
      messages.push({
        type: 'text',
        text: '[📸 รูปภาพ]',
      });
    }

    // Send to LINE
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: userId,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('LINE API error:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 400 });
    }

    // Save outgoing message(s) to database
    const savedMessages: any[] = [];
    try {
      const db = await getDb();

      // Save text message if provided
      if (message?.trim()) {
        const msgId = await nextId('line_messages');
        const textMsg = {
          id: msgId,
          line_user_id: userId,
          display_name: 'Bot',
          message: message,
          received_at: new Date().toISOString(),
          used: true,
          type: 'outgoing',
        };
        await db.collection('line_messages').insertOne(textMsg);
        savedMessages.push(textMsg);
      }

      // Save image message if provided
      if (imageDataUrl) {
        const imgId = await nextId('line_messages');
        const imgMsg = {
          id: imgId,
          line_user_id: userId,
          display_name: 'Bot',
          message: '[Image]',
          image_url: imageDataUrl,
          received_at: new Date().toISOString(),
          used: true,
          type: 'outgoing',
        };
        await db.collection('line_messages').insertOne(imgMsg);
        savedMessages.push(imgMsg);
      }
    } catch (dbErr) {
      console.error('Failed to save outgoing message:', dbErr);
    }

    return NextResponse.json({ ok: true, messages: savedMessages });
  } catch (err) {
    console.error('Error sending LINE message:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
