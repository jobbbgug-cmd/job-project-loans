import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    has_token: !!process.env.BLOB_READ_WRITE_TOKEN,
    token_prefix: process.env.BLOB_READ_WRITE_TOKEN?.slice(0, 20) ?? 'NOT SET',
    node_env: process.env.NODE_ENV,
  });
}
