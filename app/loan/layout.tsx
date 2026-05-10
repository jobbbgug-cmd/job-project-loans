'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LangProvider, LangToggle, useLang } from '@/contexts/LangContext';
import { ToastProvider } from '@/contexts/ToastContext';

interface User { userId: number; name: string; email: string; role: string; }

const NAV_KEYS = ['dashboard', 'loans', 'payments', 'customers', 'users', 'parser'] as const;
const NAV_HREFS: Record<string, string> = {
  dashboard: '/loan/dashboard', loans: '/loan/loans', payments: '/loan/payments',
  customers: '/loan/customers', users: '/loan/users', parser: '/loan/parser',
};
const NAV_ICONS: Record<string, string> = {
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  loans: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  payments: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  customers: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  parser: 'M4 6h16M4 10h16M4 14h8M4 18h8',
};
const NAV_ROLES: Record<string, string[]> = {
  dashboard: ['admin', 'staff', 'customer'],
  loans: ['admin', 'staff', 'customer'],
  payments: ['admin', 'staff', 'customer'],
  customers: ['admin', 'staff'],
  users: ['admin'],
  parser: ['admin'],
};

function LoanLayoutInner({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLang();

  useEffect(() => {
    if (window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname === '/loan/login') { setLoading(false); return; }
    fetch('/api/loan/auth/me').then(r => r.json().catch(() => ({ error: true }))).then(d => {
      if (d.error) router.push('/loan/login');
      else setUser(d);
    }).catch(() => router.push('/loan/login')).finally(() => setLoading(false));
  }, [pathname, router]);

  if (pathname === '/loan/login') return <>{children}</>;
  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-sm">{t.loanDetail.loading}</div>
    </div>
  );
  if (!user) return null;

  const navItems = NAV_KEYS.filter(k => NAV_ROLES[k].includes(user.role));

  async function logout() {
    await fetch('/api/loan/auth/logout', { method: 'POST' });
    router.push('/loan/login');
  }

  const roleLabel = t.status[user.role as keyof typeof t.status] ?? user.role;
  const ROLE_BADGE: Record<string, string> = {
    admin: 'bg-purple-500/20 text-purple-400',
    staff: 'bg-blue-500/20 text-blue-400',
    customer: 'bg-yellow-500/20 text-yellow-400',
  };
  const roleBadgeClass = ROLE_BADGE[user.role] ?? 'bg-slate-700 text-slate-400';

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        ${sidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:translate-x-0 lg:w-16'}
        transition-all duration-200 bg-slate-800 border-r border-slate-700 flex flex-col flex-shrink-0
      `}>
        <div className={`flex items-center gap-3 border-b border-slate-700 ${sidebarOpen ? 'p-3' : 'p-2 justify-center'}`}>
          <div className="flex-shrink-0 overflow-hidden" style={{ width: 40, height: 40 }}>
            <Image src="/logo.png" alt="My Money Master" width={40} height={40} className="object-cover w-full h-full"
              style={{ transform: 'scale(1.4)', transformOrigin: '50% 43%' }} />
          </div>
          {sidebarOpen && (
            <div className="leading-tight min-w-0">
              <p className="text-white font-bold text-sm truncate">Money</p>
              <p className="text-slate-400 text-xs font-normal truncate">My Money Master</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(key => {
            const href = NAV_HREFS[key];
            const active = pathname.startsWith(href);
            return (
              <Link key={key} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={NAV_ICONS[key]} />
                </svg>
                {sidebarOpen && <span>{t.nav[key as keyof typeof t.nav]}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700">
          {sidebarOpen && (
            <div className="px-3 py-2 mb-2">
              <p className="text-white text-xs font-medium truncate">{user.name}</p>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleBadgeClass}`}>{roleLabel}</span>
            </div>
          )}
          <button onClick={logout} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-red-400 transition-colors text-sm">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span>{t.logout}</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-slate-800 border-b border-slate-700 px-4 lg:px-6 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(o => !o)} className="text-slate-400 hover:text-white transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex-shrink-0 overflow-hidden" style={{ width: 36, height: 36 }}>
              <Image src="/logo.png" alt="logo" width={36} height={36} className="object-cover w-full h-full"
                style={{ transform: 'scale(1.4)', transformOrigin: '50% 43%' }} />
            </div>
            <span className="text-white font-bold text-sm">Money</span>
          </div>
          <div className="flex-1" />
          <LangToggle />
          {/* Mobile: badge บน + ชื่อล่าง | Desktop: ชื่อ + badge ข้างกัน */}
          <span className="flex-shrink-0">
            <span className="hidden lg:flex items-center gap-2">
              <span className="text-white font-medium text-sm">{user.name}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleBadgeClass}`}>{roleLabel}</span>
            </span>
            <span className="flex lg:hidden flex-col items-end gap-0.5">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleBadgeClass}`}>{roleLabel}</span>
              <span className="text-slate-400 text-[10px] leading-tight truncate max-w-[80px]">{user.name}</span>
            </span>
          </span>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export default function LoanLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <ToastProvider>
        <LoanLayoutInner>{children}</LoanLayoutInner>
      </ToastProvider>
    </LangProvider>
  );
}
