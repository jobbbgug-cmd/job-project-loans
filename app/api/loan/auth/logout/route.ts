import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, clearAuthCookie } from '@/lib/loan-auth';
import { audit } from '@/lib/loan-helpers';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  const response = NextResponse.json({ success: true });
  clearAuthCookie(response);
  if (user) await audit(user.userId, 'LOGOUT', 'user', user.userId, {});
  return response;
}
