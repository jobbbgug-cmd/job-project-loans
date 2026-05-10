'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';
import { useToast } from '@/contexts/ToastContext';

export default function NewUserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLang();
  const { pendingToast } = useToast();
  const defaultRole = searchParams.get('role') || 'customer';
  const [form, setForm] = useState({ name: '', email: '', password: '', role: defaultRole });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/loan/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t.newUser.failed); return; }
      pendingToast('บันทึกสำเร็จ');
      router.push(form.role === 'customer' ? '/loan/customers' : '/loan/users');
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/loan/users" className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{t.newUser.title}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t.newUser.subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
        {error && <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newUser.name}</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required placeholder={t.newUser.namePlaceholder}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newUser.email}</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder={t.newUser.emailPlaceholder}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newUser.password}</label>
          <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required placeholder={t.newUser.passwordPlaceholder}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newUser.role}</label>
          <select value={form.role} onChange={e => set('role', e.target.value)}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500">
            <option value="customer">{t.newUser.roles.customer}</option>
            <option value="staff">{t.newUser.roles.staff}</option>
            <option value="admin">{t.newUser.roles.admin}</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/loan/users" className="flex-1 text-center bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
            {t.newUser.cancel}
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? t.newUser.creating : t.newUser.create}
          </button>
        </div>
      </form>
    </div>
  );
}
