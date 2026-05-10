import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const loanSecret = new TextEncoder().encode(
  process.env.LOAN_JWT_SECRET || 'loan-secret-change-in-production'
);

const LOAN_PUBLIC = ['/loan/login', '/api/loan/auth/login', '/api/loan/line-webhook'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect root to loan app
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/loan', request.url));
  }

  // Only handle loan routes
  if (pathname.startsWith('/loan') || pathname.startsWith('/api/loan')) {
    const isLoanPublic = LOAN_PUBLIC.some((p) => pathname.startsWith(p));
    const loanToken = request.cookies.get('loan_auth_token')?.value;

    if (!loanToken) {
      if (!isLoanPublic) {
        return NextResponse.redirect(new URL('/loan/login', request.url));
      }
      return NextResponse.next();
    }

    try {
      await jwtVerify(loanToken, loanSecret);
      if (pathname === '/loan/login') {
        return NextResponse.redirect(new URL('/loan/dashboard', request.url));
      }
    } catch {
      if (!isLoanPublic) {
        const res = NextResponse.redirect(new URL('/loan/login', request.url));
        res.cookies.delete('loan_auth_token');
        return res;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|uploads|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp|.*\\.svg|.*\\.ico).*)'],
};
