import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

const secret = new TextEncoder().encode(
  process.env.LOAN_JWT_SECRET || process.env.JWT_SECRET || 'loan-secret-change-in-production'
);

export type Role = 'admin' | 'staff' | 'customer';

export interface LoanTokenPayload {
  userId: number;
  email: string;
  name: string;
  role: Role;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signLoanToken(payload: LoanTokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

export async function verifyLoanToken(token: string): Promise<LoanTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as LoanTokenPayload;
  } catch {
    return null;
  }
}

export async function getAuthUser(request: NextRequest): Promise<LoanTokenPayload | null> {
  const token = request.cookies.get('loan_auth_token')?.value;
  if (!token) return null;
  return verifyLoanToken(token);
}

export function requireRole(roles: Role[]) {
  return async (request: NextRequest): Promise<LoanTokenPayload | NextResponse> => {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!roles.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return user;
  };
}

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set('loan_auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.delete('loan_auth_token');
}
