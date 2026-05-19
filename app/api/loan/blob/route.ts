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
      // get() fetches the private blob with Bearer auth via undici and returns a stream
      const { get } = await import('@vercel/blob');
      const result = await get(url, { token, access: 'private' });
      if (!result || !result.stream) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return new NextResponse(result.stream as ReadableStream, {
        headers: {
          'Content-Type': result.blob.contentType ?? 'application/octet-stream',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Local dev — path is /uploads/... served by Next.js static
    return NextResponse.redirect(new URL(url, request.url));
  } catch (err) {
    console.error('blob proxy error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
