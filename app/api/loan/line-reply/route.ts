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
    let imageUrl: string | null = null;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      // Convert to base64 data URL for storage/LINE
      imageUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
      messages.push({
        type: 'image',
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
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
    try {
      const db = await getDb();

      // Save text message if provided
      if (message?.trim()) {
        const msgId = await nextId('line_messages');
        await db.collection('line_messages').insertOne({
          id: msgId,
          line_user_id: userId,
          display_name: 'Bot',
          message: message,
          received_at: new Date().toISOString(),
          used: true,
          type: 'outgoing',
        });
      }

      // Save image message if provided
      if (imageUrl) {
        const imgId = await nextId('line_messages');
        await db.collection('line_messages').insertOne({
          id: imgId,
          line_user_id: userId,
          display_name: 'Bot',
          message: '[Image]',
          image_url: imageUrl,
          received_at: new Date().toISOString(),
          used: true,
          type: 'outgoing',
        });
      }
    } catch (dbErr) {
      console.error('Failed to save outgoing message:', dbErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error sending LINE message:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
