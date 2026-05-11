'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { LangProvider, LangToggle, useLang } from '@/contexts/LangContext';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get('registered') === '1';
  const { t } = useLang();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/loan/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t.login.loginFailed); return; }
      router.push('/loan/dashboard');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 relative">
      {/* Lang toggle — fixed top-right */}
      <div className="absolute top-4 right-4">
        <LangToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-[300px] max-w-[80vw] overflow-hidden mb-2 mx-auto">
            <Image src="/logo.png" alt="My Money Master" width={300} height={300} className="object-cover w-full h-full"
              style={{ transform: 'scale(1.4)', transformOrigin: '50% 43%' }} />
          </div>
          <p className="text-slate-400 text-sm">My Money Master</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl border border-slate-700 p-8 space-y-4">
          {justRegistered && (
            <div className="bg-emerald-900/40 border border-emerald-500/30 text-emerald-400 text-sm rounded-lg px-4 py-3">สมัครสำเร็จ! กรุณาเข้าสู่ระบบ</div>
          )}
          {error && (
            <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.login.email}</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="email@example.com"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.login.password}</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? t.login.signingIn : t.login.signIn}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-4">
          ยังไม่มีบัญชี?{' '}
          <Link href="/loan/register" className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2">
            สมัครเข้าใช้งาน
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoanLoginPage() {
  return (
    <LangProvider>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </LangProvider>
  );
}
