'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface DashboardData {
  loan_stats: { status: string; count: number; total_principal: number }[];
  total_paid: number;
  payment_count: number;
  outstanding_balance: number;
  pending_payments: number;
  overdue_installments: number;
  monthly_income: { month: string; amount: number; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981', pending: '#f59e0b', completed: '#3b82f6', defaulted: '#ef4444', rejected: '#6b7280'
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/loan/dashboard').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="text-slate-400 text-sm">Loading dashboard…</div>;
  if (!data) return null;

  const totalLoans = data.loan_stats.reduce((s, r) => s + r.count, 0);
  const totalPrincipal = data.loan_stats.reduce((s, r) => s + Number(r.total_principal), 0);
  const activeLoans = data.loan_stats.find(r => r.status === 'active')?.count ?? 0;
  const pieData = data.loan_stats.filter(r => r.count > 0).map(r => ({ name: r.status, value: r.count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-0.5">Loan management overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Loans" value={String(totalLoans)} sub={`${activeLoans} active`} color="text-white" />
        <StatCard label="Total Principal" value={fmt(totalPrincipal)} color="text-emerald-400" />
        <StatCard label="Total Collected" value={fmt(Number(data.total_paid))} sub={`${data.payment_count} payments`} color="text-blue-400" />
        <StatCard label="Outstanding Balance" value={fmt(Number(data.outstanding_balance))} color="text-amber-400" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending Payments" value={String(data.pending_payments)} sub="awaiting verification" color="text-yellow-400" />
        <StatCard label="Overdue Installments" value={String(data.overdue_installments)} color="text-red-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly income */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Monthly Collections (Last 6 months)</h2>
          {data.monthly_income.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.monthly_income}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `฿${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#10b981' }} />
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Loan status pie */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Loan Status Distribution</h2>
          {pieData.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                  {pieData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.name] ?? '#6b7280'} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
