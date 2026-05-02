import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// ─── Todo app secrets ────────────────────────────────────────────────────────
const todoSecret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'change-this-secret-in-production'
);

// ─── Loan app secrets ────────────────────────────────────────────────────────
const loanSecret = new TextEncoder().encode(
  process.env.LOAN_JWT_SECRET || process.env.JWT_SECRET || 'loan-secret-change-in-production'
);

const TODO_PUBLIC  = ['/login', '/register', '/api/auth/login', '/api/auth/register'];
const LOAN_PUBLIC  = ['/loan/login', '/api/loan/auth/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Loan app routes (/loan/* and /api/loan/*) ──────────────────────────────
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

    return NextResponse.next();
  }

  // ── Todo app routes ────────────────────────────────────────────────────────
  const isPublic = TODO_PUBLIC.some((p) => pathname.startsWith(p));
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    if (!isPublic) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  try {
    await jwtVerify(token, todoSecret);
    if (pathname === '/login' || pathname === '/register') {
      return NextResponse.redirect(new URL('/todos', request.url));
    }
  } catch {
    if (!isPublic) {
      const res = NextResponse.redirect(new URL('/login', request.url));
      res.cookies.delete('auth_token');
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|uploads|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp|.*\\.svg|.*\\.ico).*)'],
};
