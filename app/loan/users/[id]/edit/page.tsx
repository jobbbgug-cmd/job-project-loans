'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';
import { useToast } from '@/contexts/ToastContext';

export default function EditUserPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
  const { pendingToast } = useToast();

  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'customer',
    is_active: true,
    phone: '',
    address: '',
    id_number: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
  }

  useEffect(() => {
    fetch(`/api/loan/users/${id}`)
      .then(r => r.json())
      .then(data => {
        setForm({
          name: data.name ?? '',
          email: data.email ?? '',
          role: data.role ?? 'customer',
          is_active: data.is_active === true || data.is_active === 1 || data.is_active === '1',
          phone: data.phone ?? '',
          address: data.address ?? '',
          id_number: data.id_number ?? '',
        });
      })
      .catch(() => setError('โหลดข้อมูลผู้ใช้ไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const res = await fetch(`/api/loan/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'แก้ไขไม่สำเร็จ'); return; }
      pendingToast('บันทึกสำเร็จ');
      router.push('/loan/users');
    } finally { setSaving(false); }
  }

  if (loading) {
    return <div className="max-w-lg mx-auto pt-20 text-center text-slate-400">กำลังโหลด…</div>;
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/loan/users" className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{t.users.edit}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{form.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
        {error && (
          <div className="bg-red-900/40 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newUser.name}</label>
          <input
            type="text" value={form.name} onChange={e => set('name', e.target.value)} required
            placeholder={t.newUser.namePlaceholder}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newUser.email}</label>
          <input
            type="email" value={form.email} onChange={e => set('email', e.target.value)} required
            placeholder={t.newUser.emailPlaceholder}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.newUser.role}</label>
          <select
            value={form.role} onChange={e => set('role', e.target.value)}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            <option value="customer">{t.newUser.roles.customer}</option>
            <option value="staff">{t.newUser.roles.staff}</option>
            <option value="admin">{t.newUser.roles.admin}</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => set('is_active', !form.is_active)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-yellow-500' : 'bg-slate-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm text-slate-300">
            {form.is_active ? t.users.active : t.users.inactive}
          </span>
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href="/loan/users"
            className="flex-1 text-center bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {t.newUser.cancel}
          </Link>
          <button
            type="submit" disabled={saving}
            className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </form>
    </div>
  );
}
