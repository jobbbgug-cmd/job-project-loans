'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { LangProvider, LangToggle, useLang } from '@/contexts/LangContext';

function RegisterForm() {
  const router = useRouter();
  const { t } = useLang();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/loan/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError((data as { error?: string }).error || 'สมัครไม่สำเร็จ'); return; }
      router.push('/loan/login?registered=1');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <LangToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-[200px] max-w-[60vw] overflow-hidden mb-2 mx-auto">
            <Image src="/logo.png" alt="My Money Master" width={200} height={200} className="object-cover w-full h-full"
              style={{ transform: 'scale(1.4)', transformOrigin: '50% 43%' }} />
          </div>
          <p className="text-slate-400 text-sm">My Money Master</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl border border-slate-700 p-8 space-y-4">
          <h2 className="text-white font-bold text-lg mb-1">สมัครเข้าใช้งาน</h2>

          {error && (
            <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newUser.name}</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required
              placeholder={t.newUser.namePlaceholder}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newUser.email}</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
              placeholder={t.newUser.emailPlaceholder}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newUser.password}</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required
              placeholder={t.newUser.passwordPlaceholder}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            <p className="text-slate-500 text-xs mt-1">อย่างน้อย 8 ตัวอักษร</p>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 mt-2">
            {loading ? 'กำลังสมัคร...' : 'สมัครเข้าใช้งาน'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-4">
          มีบัญชีแล้ว?{' '}
          <Link href="/loan/login" className="text-yellow-400 hover:text-yellow-300 underline underline-offset-2">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <LangProvider>
      <RegisterForm />
    </LangProvider>
  );
}
