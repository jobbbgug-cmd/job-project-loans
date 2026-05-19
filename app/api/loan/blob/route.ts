import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/loan-auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = request.nextUrl.searchParams.get('url');
  if (!url || !url.startsWith('https://')) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    if (token) {
      const { get } = await import('@vercel/blob');
      const blob = await get(url, { token });
      if (!blob) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const res = await fetch(blob.downloadUrl);
      if (!res.ok) return new NextResponse(null, { status: res.status });

      const body = await res.blob();
      return new NextResponse(body, {
        headers: {
          'Content-Type': blob.contentType ?? 'application/octet-stream',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Local dev fallback — direct fetch (no auth needed for local files)
    const res = await fetch(url);
    if (!res.ok) return new NextResponse(null, { status: res.status });
    const body = await res.blob();
    return new NextResponse(body, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('blob proxy error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
