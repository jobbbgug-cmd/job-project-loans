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
      const meta = await get(url, { token, access: 'private' });
      if (!meta) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      // Redirect browser to signed downloadUrl — avoids server-to-server 403
      return NextResponse.redirect(meta.downloadUrl);
    }

    // Local dev — serve directly from filesystem (path starting with /)
    return NextResponse.redirect(new URL(url, request.url));
  } catch (err) {
    console.error('blob proxy error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
