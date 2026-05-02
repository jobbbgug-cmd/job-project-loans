'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface User { id: number; name: string; email: string; role: string; is_active: number; created_at: string; }

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-500/20 text-purple-400', staff: 'bg-blue-500/20 text-blue-400', customer: 'bg-slate-500/20 text-slate-400'
};

function fmtDate(s: string) { return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<number | null>(null);

  async function load() {
    const d = await fetch('/api/loan/users').then(r => r.json());
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-slate-400 text-sm mt-0.5">{users.length} total users</p>
        </div>
        <Link href="/loan/users/new" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + New User
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
          className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64" />
        <div className="flex gap-2">
          {['', 'admin', 'staff', 'customer'].map(r => (
            <button key={r} onClick={() => setFilterRole(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filterRole === r ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
              {r || 'All Roles'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
                {['Name', 'Email', 'Role', 'Joined', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-slate-300">{u.email}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${ROLE_BADGE[u.role]}`}>{u.role}</span></td>
                    <td className="px-4 py-3 text-slate-300">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <Link href={`/loan/users/${u.id}/edit`} className="text-slate-400 hover:text-white text-xs transition-colors">Edit</Link>
                        <button onClick={() => toggleActive(u)} disabled={acting === u.id}
                          className={`text-xs transition-colors disabled:opacity-50 ${u.is_active ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
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
    </div>
  );
}
