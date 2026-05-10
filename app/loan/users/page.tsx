'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LangContext';

interface User { id: number; name: string; email: string; role: string; is_active: number; created_at: string; }

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-500/20 text-purple-400', staff: 'bg-blue-500/20 text-blue-400', customer: 'bg-yellow-500/20 text-yellow-400',
};

function fmtDate(s: string) { return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<number | null>(null);
  const { t } = useLang();

  async function load() {
    const d = await fetch('/api/loan/users').then(r => r.json().catch(() => ([])));
    setUsers(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(u: User) {
    setActing(u.id);
    await fetch(`/api/loan/users/${u.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: u.is_active ? 0 : 1 }) });
    await load();
    setActing(null);
  }

  const filtered = users.filter(u => {
    if (filterRole && u.role !== filterRole) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const roleFilters = ['', 'admin', 'staff', 'customer'] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{t.users.title}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t.users.totalFmt(users.length)}</p>
        </div>
        <Link href="/loan/users/new" className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          {t.users.new}
        </Link>
      </div>

      {/* Search input — always visible */}
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t.users.search}
        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500" />

      {/* Desktop filter buttons */}
      <div className="hidden md:flex gap-2">
        {roleFilters.map(r => {
          const activeClass = r === 'admin' ? 'bg-purple-600 text-white'
            : r === 'staff' ? 'bg-blue-600 text-white'
            : r === 'customer' ? 'bg-yellow-600 text-white'
            : 'bg-slate-500 text-white';
          return (
            <button key={r} onClick={() => setFilterRole(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterRole === r ? activeClass : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
              {r === '' ? t.users.allRoles : (t.status[r as keyof typeof t.status] ?? r)}
            </button>
          );
        })}
      </div>

      {/* Mobile role filter cards */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {roleFilters.map(r => {
          const count = r === '' ? users.length : users.filter(u => u.role === r).length;
          const isActive = filterRole === r;
          const activeColor = r === 'admin' ? 'bg-purple-600'
            : r === 'staff' ? 'bg-blue-600'
            : r === 'customer' ? 'bg-yellow-600'
            : 'bg-slate-600';
          const numColor = r === 'admin' ? 'text-purple-400'
            : r === 'staff' ? 'text-blue-400'
            : r === 'customer' ? 'text-yellow-400'
            : 'text-white';
          return (
            <button key={r} onClick={() => setFilterRole(r)}
              className={`rounded-xl p-3 text-center transition-colors ${isActive ? activeColor : 'bg-slate-800 border border-slate-700'}`}>
              <div className={`text-xs font-medium mb-1 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                {r === '' ? t.users.allRoles : (t.status[r as keyof typeof t.status] ?? r)}
              </div>
              <div className={`text-xl font-bold ${isActive ? 'text-white' : numColor}`}>
                {count}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.users.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.users.noFound}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
                {(['name', 'email', 'role', 'joined', 'status', 'actions'] as const).map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{t.users.cols[h]}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-slate-300">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[u.role]}`}>
                        {t.status[u.role as keyof typeof t.status] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {u.is_active ? t.users.active : t.users.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <Link href={`/loan/users/${u.id}/edit`} className="text-slate-400 hover:text-white text-xs transition-colors">{t.users.edit}</Link>
                        <button onClick={() => toggleActive(u)} disabled={acting === u.id}
                          className={`text-xs transition-colors disabled:opacity-50 ${u.is_active ? 'text-red-400 hover:text-red-300' : 'text-yellow-400 hover:text-yellow-300'}`}>
                          {u.is_active ? t.users.deactivate : t.users.activate}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.users.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.users.noFound}</div>
        ) : filtered.map(u => (
          <div key={u.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-white font-medium">{u.name}</div>
                <div className="text-slate-400 text-sm">{u.email}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ml-2 ${ROLE_BADGE[u.role]}`}>
                {t.status[u.role as keyof typeof t.status] ?? u.role}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                {u.is_active ? t.users.active : t.users.inactive}
              </span>
              <span className="text-slate-500 text-xs">{fmtDate(u.created_at)}</span>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
              <Link href={`/loan/users/${u.id}/edit`} className="px-3 py-1.5 rounded-lg bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/30 text-xs font-medium transition-colors">{t.users.edit}</Link>
              <button onClick={() => toggleActive(u)} disabled={acting === u.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${u.is_active ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30' : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'}`}>
                {u.is_active ? t.users.deactivate : t.users.activate}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
