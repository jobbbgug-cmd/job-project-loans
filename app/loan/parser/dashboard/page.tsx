'use client';

import React, { useState, useEffect } from 'react';

interface Row {
  name: string;
  handicap: string;
  odds: string;
  score: string;
  scoreFinal: string;
  betAmount: string;
  result: string;
}

interface Session {
  id: number;
  label: string;
  rows_data: Row[];
  sum_bet: number;
  sum_result: number;
  profit: number;
  saved_at: string;
}

function r2(n: number) { return Math.round(n * 100) / 100; }

function safeRows(data: unknown): Row[] {
  if (Array.isArray(data)) return data as Row[];
  if (typeof data === 'string') { try { return JSON.parse(data); } catch { return []; } }
  return [];
}

function calcSummary(row: Row): number | null {
  const bet  = Number(row.betAmount);
  const odds = Number(row.odds);
  if (!bet || bet <= 0 || !row.result) return null;
  switch (row.result) {
    case 'win_full':  return r2(bet * odds);
    case 'win_half':  return r2((bet * odds + bet) / 2);
    case 'lose_full': return 0;
    case 'lose_half': return r2(bet / 2);
    case 'draw':      return bet;
    default:          return null;
  }
}

const RESULT_LABELS: Record<string, string> = {
  win_full: 'ชนะเต็ม', win_half: 'ชนะครึ่ง',
  lose_full: 'แพ้เต็ม', lose_half: 'แพ้ครึ่ง',
  draw: 'เสมอทุน', '': 'ยังไม่ระบุ',
};

const RESULT_BG: Record<string, string> = {
  win_full: 'bg-emerald-500/15 text-emerald-400', win_half: 'bg-emerald-500/10 text-emerald-300',
  lose_full: 'bg-red-500/15 text-red-400', lose_half: 'bg-red-500/10 text-red-300',
  draw: 'bg-slate-500/15 text-slate-300', '': 'bg-slate-700/50 text-slate-500',
};

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function ParserDashboard() {
  const [sessions, setSessions]       = useState<Session[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/loan/parser-sessions', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSessions(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Sessions (DB) aggregate ──────────────────────────────────────────────
  const sessSumBet    = r2(sessions.reduce((s, x) => s + Number(x.sum_bet), 0));
  const sessSumResult = r2(sessions.reduce((s, x) => s + Number(x.sum_result), 0));
  const sessProfit    = r2(sessions.reduce((s, x) => s + Number(x.profit), 0));

  const hasSessions = sessions.length > 0;

  // Latest session display
  const latestSession  = sessions[0];
  const displayRows    = safeRows(latestSession?.rows_data);
  const displaySummaries = displayRows.map(r => calcSummary(r));
  const displayTotal   = displayRows.length;
  const displayBet     = r2(Number(latestSession?.sum_bet ?? 0));
  const displayResult  = r2(Number(latestSession?.sum_result ?? 0));
  const displayProfit  = r2(Number(latestSession?.profit ?? 0));
  const displayWithRes = displayRows.filter(r => r.result).length;
  const displayWinCount  = displayRows.filter(r => r.result === 'win_full' || r.result === 'win_half').length;
  const displayLoseCount = displayRows.filter(r => r.result === 'lose_full' || r.result === 'lose_half').length;
  const displayDrawCount = displayRows.filter(r => r.result === 'draw').length;
  const displayWinRate   = displayWithRes > 0 ? Math.round((displayWinCount / displayWithRes) * 100) : 0;

  if (loading) return <div className="text-slate-400 text-sm py-12 text-center">กำลังโหลด…</div>;

  if (!hasSessions) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg className="w-12 h-12 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-slate-400 text-sm">ยังไม่มีข้อมูล — กลับไปแยกข้อมูลและกด บันทึก ก่อน</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
          <p className="text-slate-400 text-sm mt-1">ข้อมูลรวมจาก {sessions.length} session</p>
        </div>
        <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">แสดงข้อมูลจาก session ล่าสุด</span>
      </div>

      {/* Stat cards — aggregate ALL sessions */}
      {(() => {
        const allSessTotalRows = sessions.reduce((s, x) => s + safeRows(x.rows_data).length, 0);
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="รายการทั้งหมด" value={String(allSessTotalRows)} sub="รวมทุกวัน" />
            <StatCard label="ยอดแทงรวม" value={sessSumBet > 0 ? fmt(sessSumBet) : '—'} sub="บาท (รวมทุกวัน)" />
            <StatCard
              label="ยอดผลสรุปรวม"
              value={sessSumBet > 0 ? fmt(sessSumResult) : '—'}
              sub="บาท (รวมทุกวัน)"
              color="text-yellow-400"
            />
            <StatCard
              label="กำไร / ขาดทุน"
              value={sessSumBet > 0 ? (sessProfit >= 0 ? `+${fmt(sessProfit)}` : fmt(sessProfit)) : '—'}
              sub="บาท (รวมทุกวัน)"
              color={sessProfit > 0 ? 'text-emerald-400' : sessProfit < 0 ? 'text-red-400' : 'text-slate-300'}
            />
          </div>
        );
      })()}

      {/* Win rate + สรุปยอดประจำวัน */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 flex flex-col items-center justify-center gap-3">
          <p className="text-slate-400 text-xs">อัตราชนะ</p>
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none"
                stroke={displayProfit > 0 ? '#10b981' : '#ef4444'}
                strokeWidth="3"
                strokeDasharray={`${displayWinRate} ${100 - displayWinRate}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${displayProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{displayWinRate}%</span>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-slate-400">
            <span><span className="text-yellow-400 font-semibold">{displayWinCount}</span> ชนะ</span>
            <span><span className="text-red-400 font-semibold">{displayLoseCount}</span> แพ้</span>
            <span><span className="text-slate-500 font-semibold">{displayDrawCount}</span> เสมอ</span>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <p className="text-sm font-semibold text-white">สรุปยอดรวมประจำวัน — {latestSession?.label ?? ''}</p>
          </div>
          <div className="divide-y divide-slate-700/60">
            {[
              { label: 'รายการทั้งหมด', value: `${displayTotal} รายการ`, color: 'text-white' },
              { label: 'ยอดแทงรวม', value: displayBet > 0 ? fmt(displayBet) : '—', color: 'text-white font-mono' },
              { label: 'ยอดผลสรุปรวม', value: displayWithRes > 0 ? fmt(displayResult) : '—', color: `font-mono ${displayWithRes > 0 ? 'text-yellow-400' : 'text-slate-400'}` },
              { label: 'กำไร / ขาดทุน', value: displayWithRes > 0 ? (displayProfit >= 0 ? `+${fmt(displayProfit)}` : fmt(displayProfit)) : '—', color: `font-mono text-lg font-semibold ${displayProfit > 0 ? 'text-emerald-400' : displayProfit < 0 ? 'text-red-400' : 'text-slate-400'}` },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between px-5 py-3.5">
                <span className="text-slate-400 text-sm">{item.label}</span>
                <span className={`${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* สรุปยอดย้อนหลัง */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="text-sm font-semibold">สรุปยอดย้อนหลัง</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs">
                <th className="px-4 py-3 text-left font-medium">วันที่</th>
                <th className="px-4 py-3 text-center font-medium">ยอดแทงรวม</th>
                <th className="px-4 py-3 text-center font-medium">ยอดผลสรุปรวม</th>
                <th className="px-4 py-3 text-center font-medium">กำไร / ขาดทุน</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, si) => {
                const p = Number(s.profit);
                const d = new Date(s.saved_at).toLocaleDateString('th-TH', { dateStyle: 'medium' });
                const isOpen = expandedSession === s.id;
                const sRows = safeRows(s.rows_data);
                return (
                  <React.Fragment key={si}>
                    <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-white">{s.label ?? d}</td>
                      <td className="px-4 py-3 text-center font-mono text-white">{fmt(Number(s.sum_bet))}</td>
                      <td className="px-4 py-3 text-center font-mono text-yellow-400">
                        {fmt(Number(s.sum_result))}
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-semibold ${p > 0 ? 'text-emerald-400' : p < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {p >= 0 ? `+${fmt(p)}` : fmt(p)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setExpandedSession(isOpen ? null : s.id)}
                          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 ml-auto transition-colors"
                        >
                          {isOpen ? 'ซ่อน' : 'ดูรายการ'}
                          <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-slate-700/50">
                        <td colSpan={5} className="px-0 py-0 bg-slate-900/50">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-700 text-slate-500">
                                <th className="px-6 py-2 text-left font-medium w-8">#</th>
                                <th className="px-4 py-2 text-left font-medium">ชื่อ</th>
                                <th className="px-4 py-2 text-center font-medium">ราคาน้ำ</th>
                                <th className="px-4 py-2 text-center font-medium">สกอร์(ก่อน)</th>
                                <th className="px-4 py-2 text-center font-medium">สกอร์(จบ)</th>
                                <th className="px-4 py-2 text-center font-medium">แทง</th>
                                <th className="px-4 py-2 text-center font-medium">ผลลัพธ์</th>
                                <th className="px-4 py-2 text-center font-medium">ผลสรุป</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/30">
                              {sRows.map((row, i) => {
                                const sv = calcSummary(row);
                                return (
                                  <tr key={i} className="hover:bg-slate-700/20">
                                    <td className="px-6 py-2 text-slate-500">{i + 1}</td>
                                    <td className="px-4 py-2 text-white font-medium">{row.name}</td>
                                    <td className="px-4 py-2 text-center"><span className="bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded font-mono">{row.odds}</span></td>
                                    <td className="px-4 py-2 text-center text-slate-300 font-mono">{row.score || '—'}</td>
                                    <td className="px-4 py-2 text-center text-white font-mono font-semibold">{row.scoreFinal || '—'}</td>
                                    <td className="px-4 py-2 text-center font-mono text-white">{Number(row.betAmount) > 0 ? fmt(Number(row.betAmount)) : '—'}</td>
                                    <td className="px-4 py-2 text-center">
                                      {row.result ? <span className={`px-1.5 py-0.5 rounded ${RESULT_BG[row.result]}`}>{RESULT_LABELS[row.result]}</span> : <span className="text-slate-600">—</span>}
                                    </td>
                                    <td className="px-4 py-2 text-center font-mono font-semibold">
                                      <span className={sv !== null && sv > 0 ? 'text-emerald-400' : sv === 0 ? 'text-red-400' : 'text-slate-500'}>
                                        {sv !== null ? fmt(sv) : '—'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-600 bg-slate-700/40 text-xs font-semibold">
                <td className="px-4 py-3 text-slate-400">รวมทั้งหมด</td>
                <td className="px-4 py-3 text-center font-mono text-white">{fmt(sessSumBet)}</td>
                <td className="px-4 py-3 text-center font-mono text-yellow-400">{fmt(sessSumResult)}</td>
                <td className={`px-4 py-3 text-center font-mono font-semibold ${sessProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {sessProfit >= 0 ? `+${fmt(sessProfit)}` : fmt(sessProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* รายการทั้งหมด (latest session) */}
      {displayRows.length > 0 && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold">รายการทั้งหมด</h2>
            <span className="text-xs text-slate-500">จาก session ล่าสุด: {sessions[0]?.label}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs">
                  <th className="px-4 py-3 text-left font-medium w-8">#</th>
                  <th className="px-4 py-3 text-left font-medium">ชื่อ</th>
                  <th className="px-4 py-3 text-center font-medium">ราคาน้ำ</th>
                  <th className="px-4 py-3 text-center font-medium">สกอร์(ก่อน)</th>
                  <th className="px-4 py-3 text-center font-medium">สกอร์(จบ)</th>
                  <th className="px-4 py-3 text-center font-medium">แทง</th>
                  <th className="px-4 py-3 text-center font-medium">ผลลัพธ์</th>
                  <th className="px-4 py-3 text-center font-medium">ผลสรุป</th>
                  <th className="px-4 py-3 text-center font-medium">กำไร/ขาดทุน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {displayRows.map((row, i) => {
                  const sv  = displaySummaries[i];
                  const bet = Number(row.betAmount) || 0;
                  const pnl = sv !== null ? r2(bet - sv) : null;
                  return (
                    <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">{row.name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded font-mono text-xs">{row.odds}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.score ? <span className="text-slate-300 font-mono text-xs">{row.score}</span> : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.scoreFinal ? <span className="text-white font-mono text-xs font-semibold">{row.scoreFinal}</span> : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="font-mono text-xs text-white">{bet > 0 ? fmt(bet) : '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.result
                          ? <span className={`px-2 py-0.5 rounded text-xs ${RESULT_BG[row.result]}`}>{RESULT_LABELS[row.result]}</span>
                          : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-mono text-xs font-semibold ${sv !== null && sv > 0 ? 'text-emerald-400' : sv === 0 ? 'text-red-400' : 'text-slate-500'}`}>
                          {sv !== null ? fmt(sv) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-mono text-xs font-semibold ${pnl !== null && pnl > 0 ? 'text-emerald-400' : pnl !== null && pnl < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                          {pnl !== null ? (pnl >= 0 ? `+${fmt(pnl)}` : fmt(pnl)) : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
