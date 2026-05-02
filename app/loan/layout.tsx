'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface User { userId: number; name: string; email: string; role: string; }

const NAV = [
  { href: '/loan/dashboard', label: 'Dashboard',  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', roles: ['admin','staff','customer'] },
  { href: '/loan/loans',     label: 'Loans',      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', roles: ['admin','staff','customer'] },
  { href: '/loan/payments',  label: 'Payments',   icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', roles: ['admin','staff','customer'] },
  { href: '/loan/customers', label: 'Customers',  icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', roles: ['admin','staff'] },
  { href: '/loan/users',     label: 'Users',      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', roles: ['admin'] },
];

export default function LoanLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/loan/login') { setLoading(false); return; }
    fetch('/api/loan/auth/me').then(r => r.json()).then(d => {
      if (d.error) router.push('/loan/login');
      else setUser(d);
    }).finally(() => setLoading(false));
  }, [pathname, router]);

  if (pathname === '/loan/login') return <>{children}</>;
  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-slate-400 text-sm">Loading…</div></div>;
  if (!user) return null;

  const navItems = NAV.filter(n => n.roles.includes(user.role));

  async function logout() {
    await fetch('/api/loan/auth/logout', { method: 'POST' });
    router.push('/loan/login');
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-200 bg-slate-800 border-r border-slate-700 flex flex-col flex-shrink-0`}>

        {/* Logo */}
        <div className={`flex items-center gap-3 border-b border-slate-700 ${sidebarOpen ? 'p-3' : 'p-2 justify-center'}`}>
          <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 40, height: 40 }}>
            <Image src="/logo.png" alt="My Money Master" width={40} height={40} className="object-cover w-full h-full" />
          </div>
          {sidebarOpen && (
            <div className="leading-tight min-w-0">
              <p className="text-white font-bold text-xs truncate">My Money</p>
              <p className="text-emerald-400 font-bold text-xs truncate">Master</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-slate-700">
          {sidebarOpen && (
            <div className="px-3 py-2 mb-2">
              <p className="text-white text-xs font-medium truncate">{user.name}</p>
              <p className="text-slate-400 text-xs capitalize">{user.role}</p>
            </div>
          )}
          <button onClick={logout} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-red-400 transition-colors text-sm">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(o => !o)} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1" />
          <span className="text-slate-400 text-sm">
            <span className="text-white font-medium">{user.name}</span>
            <span className="ml-2 px-2 py-0.5 bg-slate-700 rounded text-xs capitalize">{user.role}</span>
          </span>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
