'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import { useLang } from '@/contexts/LangContext';

interface DashboardData {
  loan_stats: { status: string; count: number; total_principal: number }[];
  total_paid: number;
  payment_count: number;
  outstanding_balance: number;
  pending_payments: number;
  overdue_installments: number;
  monthly_income: { month: string; amount: number; count: number }[];
}
interface User { role: string; }

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981', pending: '#f59e0b', completed: '#3b82f6', defaulted: '#ef4444', rejected: '#6b7280',
};

function fmt(n: number) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(n);
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLang();

  useEffect(() => {
    Promise.all([
      fetch('/api/loan/auth/me').then(r => r.json().catch(() => ({}))),
      fetch('/api/loan/dashboard').then(r => r.json().catch(() => ({}))),
    ]).then(([u, d]) => { setUser(u); setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 text-sm">{t.loanDetail.loading}</div>;
  if (!data || !user) return null;

  const totalLoans = data.loan_stats.reduce((s, r) => s + r.count, 0);
  const totalPrincipal = data.loan_stats.reduce((s, r) => s + Number(r.total_principal), 0);
  const activeLoans = data.loan_stats.find(r => r.status === 'active')?.count ?? 0;

  // ── Customer dashboard ────────────────────────────────────────────────────
  if (user.role === 'customer') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">{t.dashboard.title}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t.dashboard.subtitle}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <StatCard label={t.dashboard.totalLoans} value={String(totalLoans)} sub={`${activeLoans} ${t.dashboard.active}`} color="text-white" />
          <StatCard label={t.dashboard.totalPrincipal} value={fmt(totalPrincipal)} color="text-yellow-400" />
          <StatCard label={t.dashboard.totalCollected} value={fmt(Number(data.total_paid))} sub={`${data.payment_count} ${t.dashboard.payments}`} color="text-blue-400" />
          <StatCard label={t.dashboard.outstandingBalance} value={fmt(Number(data.outstanding_balance))} color="text-yellow-400" />
        </div>
      </div>
    );
  }

  // ── Admin / Staff dashboard ───────────────────────────────────────────────
  const pieData = data.loan_stats
    .filter(r => r.count > 0)
    .map(r => ({ name: t.status[r.status as keyof typeof t.status] ?? r.status, value: r.count, origStatus: r.status }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">{t.dashboard.title}</h1>
        <p className="text-slate-400 text-sm mt-0.5">{t.dashboard.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t.dashboard.totalLoans} value={String(totalLoans)} sub={`${activeLoans} ${t.dashboard.active}`} color="text-white" />
        <StatCard label={t.dashboard.totalPrincipal} value={fmt(totalPrincipal)} color="text-yellow-400" />
        <StatCard label={t.dashboard.totalCollected} value={fmt(Number(data.total_paid))} sub={`${data.payment_count} ${t.dashboard.payments}`} color="text-blue-400" />
        <StatCard label={t.dashboard.outstandingBalance} value={fmt(Number(data.outstanding_balance))} color="text-yellow-400" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t.dashboard.pendingPayments} value={String(data.pending_payments)} sub={t.dashboard.awaitingVerification} color="text-yellow-400" />
        <StatCard label={t.dashboard.overdueInstallments} value={String(data.overdue_installments)} color="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <div className="flex items-start justify-between mb-5">
            <h2 className="text-white font-semibold text-sm">{t.dashboard.monthlyCollections}</h2>
            {data.monthly_income.length > 0 && (
              <div className="text-right">
                <div className="text-emerald-400 font-bold text-sm">{fmt(data.monthly_income.reduce((s, m) => s + Number(m.amount), 0))}</div>
                <div className="text-slate-500 text-xs mt-0.5">รวม 6 เดือน</div>
              </div>
            )}
          </div>
          {data.monthly_income.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">{t.dashboard.noData}</p>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={data.monthly_income} barCategoryGap="35%" margin={{ top: 20, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(16,185,129,0.06)' }}
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '8px 14px' }}
                  labelStyle={{ color: '#f1f5f9', fontWeight: 600, fontSize: 12, marginBottom: 4 }}
                  formatter={(v, _name, props) => [
                    <span key="v" style={{ color: '#10b981', fontWeight: 700 }}>{fmt(Number(v))}</span>,
                    <span key="c" style={{ color: '#64748b', fontSize: 11 }}>{props.payload?.count} รายการ</span>,
                  ]}
                  separator=" "
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {data.monthly_income.map((_entry, i) => (
                    <Cell key={i} fill="url(#barGradient)" />
                  ))}
                  <LabelList dataKey="amount" position="top"
                    formatter={(v: unknown) => { const n = Number(v); return n === 0 ? '' : n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n); }}
                    style={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }} />
                </Bar>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <h2 className="text-white font-semibold text-sm mb-4">{t.dashboard.loanStatusDist}</h2>
          {pieData.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">{t.dashboard.noData}</p>
          ) : (
            <>
              <div className="relative flex justify-center mb-5">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={88} dataKey="value" strokeWidth={3} stroke="#1e293b">
                      {pieData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.origStatus] ?? '#6b7280'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-white">{totalLoans}</span>
                  <span className="text-slate-400 text-xs mt-0.5">รายการ</span>
                </div>
              </div>
              <div className="space-y-3">
                {pieData.map((entry, i) => {
                  const pct = totalLoans > 0 ? Math.round(entry.value / totalLoans * 100) : 0;
                  const color = STATUS_COLORS[entry.origStatus] ?? '#6b7280';
                  return (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-slate-300 text-sm flex-1">{entry.name}</span>
                        <span className="text-white text-sm font-semibold">{entry.value}</span>
                        <span className="text-slate-400 text-xs w-10 text-right">{pct}%</span>
                      </div>
                      <div className="ml-5 bg-slate-700 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
