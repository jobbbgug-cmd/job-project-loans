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
  win_full: 'bg-emerald-100 text-emerald-700', win_half: 'bg-emerald-50 text-emerald-600',
  lose_full: 'bg-red-100 text-red-700', lose_half: 'bg-red-50 text-red-600',
  draw: 'bg-amber-100 text-amber-700', '': 'bg-slate-100 text-slate-600',
};

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-slate-500 text-xs mb-1 font-medium">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function ParserDashboard() {
  const [sessions, setSessions]       = useState<Session[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [deletingId, setDeletingId]   = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [savingImageId, setSavingImageId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/loan/parser-sessions', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSessions(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function deleteSession(id: number) {
    if (!confirm('ยืนยันการลบ session นี้?')) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/loan/parser-sessions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
        setExpandedSession(null);
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'ลบไม่สำเร็จ');
      }
    } catch (err) {
      setDeleteError('เกิดข้อผิดพลาด');
    } finally {
      setDeletingId(null);
    }
  }

  async function saveSessionLabel(id: number) {
    try {
      const res = await fetch(`/api/loan/parser-sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editingLabel }),
      });
      if (res.ok) {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, label: editingLabel } : s));
        setEditingId(null);
        setEditingLabel('');
      }
    } catch (err) {
      console.error('Failed to save label:', err);
    }
  }

  async function saveSessionImage(id: number, sRows: Row[], label: string) {
    setSavingImageId(id);
    try {
      const scale = 2;
      const pad = 10;
      const rowH = 38;
      const headH = 42;
      const footH = 42;
      const font = 'system-ui,-apple-system,sans-serif';

      const cols = [
        { label: '#', width: 36, align: 'center' as const },
        { label: 'ชื่อ', width: 150, align: 'left' as const },
        { label: 'ราคาน้ำ', width: 72, align: 'center' as const },
        { label: 'สกอร์(ก่อน)', width: 92, align: 'center' as const },
        { label: 'สกอร์(จบ)', width: 88, align: 'center' as const },
        { label: 'จำนวนแทง', width: 110, align: 'right' as const },
        { label: 'ผลลัพธ์', width: 90, align: 'center' as const },
        { label: 'ผลสรุป', width: 90, align: 'right' as const },
      ];

      const totalW = cols.reduce((s, c) => s + c.width, 0);
      const totalH = headH + rowH * sRows.length + footH;

      const canvas = document.createElement('canvas');
      canvas.width = totalW * scale;
      canvas.height = totalH * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);

      const fill = (x: number, y: number, w: number, h: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
      };
      const txt = (s: string, x: number, y: number, color: string, size = 12, bold = false, align: 'left' | 'center' | 'right' = 'left') => {
        ctx.fillStyle = color;
        ctx.font = `${bold ? '600 ' : ''}${size}px ${font}`;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.fillText(s, x, y);
      };
      const cx = (col: typeof cols[number], x0: number) =>
        col.align === 'center' ? x0 + col.width / 2 : col.align === 'right' ? x0 + col.width - pad : x0 + pad;

      fill(0, 0, totalW, totalH, '#f8fafc');
      fill(0, 0, totalW, headH, '#f0f4f8');
      let x0 = 0;
      cols.forEach(col => {
        txt(col.label, cx(col, x0), headH / 2, '#0f172a', 11, true, col.align);
        x0 += col.width;
      });
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, headH);
      ctx.lineTo(totalW, headH);
      ctx.stroke();

      const RLABEL: Record<string, string> = {
        win_full: 'ชนะเต็ม',
        win_half: 'ชนะครึ่ง',
        lose_full: 'แพ้เต็ม',
        lose_half: 'แพ้ครึ่ง',
        draw: 'เสมอทุน',
        '': '—',
      };
      const rcol = (r: string) =>
        r.startsWith('win') ? '#059669' : r.startsWith('lose') ? '#dc2626' : r === 'draw' ? '#ca8a04' : '#64748b';

      sRows.forEach((row, i) => {
        const y = headH + i * rowH;
        fill(0, y, totalW, rowH, i % 2 === 0 ? '#ffffff' : '#f9fafb');
        const sv = calcSummary(row);
        const cells: [string, string][] = [
          [String(i + 1), '#64748b'],
          [row.name, '#1e293b'],
          [row.odds || '—', '#2563eb'],
          [row.score || '—', '#059669'],
          [row.scoreFinal || '—', '#64748b'],
          [row.betAmount ? Number(row.betAmount).toLocaleString('th-TH') : '—', '#1e293b'],
          [RLABEL[row.result] ?? '—', rcol(row.result)],
          [sv !== null ? sv.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—', sv !== null ? sv > 0 ? '#059669' : '#dc2626' : '#64748b'],
        ];
        x0 = 0;
        cells.forEach(([val, color], ci) => {
          txt(val, cx(cols[ci], x0), y + rowH / 2, color, 12, i === 0, cols[ci].align);
          x0 += cols[ci].width;
        });
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y + rowH);
        ctx.lineTo(totalW, y + rowH);
        ctx.stroke();
      });

      const fy = headH + sRows.length * rowH;
      fill(0, fy, totalW, footH, '#f0f4f8');
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, fy);
      ctx.lineTo(totalW, fy);
      ctx.stroke();

      const filename = `session-${label || new Date().toISOString().slice(0, 10)}.png`;
      if (typeof navigator.share === 'function') {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
        );
        const file = new File([blob], filename, { type: 'image/png' });
        await navigator.share({ files: [file], title: filename });
      } else {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (err) {
      console.error('saveSessionImage:', err);
    } finally {
      setSavingImageId(null);
    }
  }

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
    <div className="space-y-6 text-slate-900 bg-slate-50 min-h-screen p-6 rounded-2xl">
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
            <StatCard label="รายการทั้งหมด" value={String(allSessTotalRows)} sub="รวมทุกวัน" color="text-blue-600" />
            <StatCard label="ยอดแทงรวม" value={sessSumBet > 0 ? fmt(sessSumBet) : '—'} sub="บาท (รวมทุกวัน)" color="text-yellow-600" />
            <StatCard
              label="ยอดผลสรุปรวม"
              value={sessSumBet > 0 ? fmt(sessSumResult) : '—'}
              sub="บาท (รวมทุกวัน)"
              color="text-amber-600"
            />
            <StatCard
              label="กำไร / ขาดทุน"
              value={sessSumBet > 0 ? (sessProfit >= 0 ? `+${fmt(sessProfit)}` : fmt(sessProfit)) : '—'}
              sub="บาท (รวมทุกวัน)"
              color={sessProfit > 0 ? 'text-emerald-600' : sessProfit < 0 ? 'text-red-600' : 'text-slate-600'}
            />
          </div>
        );
      })()}

      {/* Win rate + สรุปยอดประจำวัน */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-center justify-center gap-3 shadow-sm">
          <p className="text-slate-600 text-xs font-medium">อัตราชนะ</p>
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none"
                stroke={displayProfit > 0 ? '#16a34a' : '#dc2626'}
                strokeWidth="3"
                strokeDasharray={`${displayWinRate} ${100 - displayWinRate}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${displayProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{displayWinRate}%</span>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-slate-600">
            <span><span className="text-yellow-600 font-semibold">{displayWinCount}</span> ชนะ</span>
            <span><span className="text-red-600 font-semibold">{displayLoseCount}</span> แพ้</span>
            <span><span className="text-slate-500 font-semibold">{displayDrawCount}</span> เสมอ</span>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
            <p className="text-sm font-semibold text-slate-900">สรุปยอดรวมประจำวัน — {latestSession?.label ?? ''}</p>
          </div>
          <div className="divide-y divide-slate-200">
            {[
              { label: 'รายการทั้งหมด', value: `${displayTotal} รายการ`, color: 'text-blue-600 font-semibold' },
              { label: 'ยอดแทงรวม', value: displayBet > 0 ? fmt(displayBet) : '—', color: 'text-yellow-600 font-mono font-semibold' },
              { label: 'ยอดผลสรุปรวม', value: displayWithRes > 0 ? fmt(displayResult) : '—', color: `font-mono font-semibold ${displayWithRes > 0 ? 'text-amber-600' : 'text-slate-600'}` },
              { label: 'กำไร / ขาดทุน', value: displayWithRes > 0 ? (displayProfit >= 0 ? `+${fmt(displayProfit)}` : fmt(displayProfit)) : '—', color: `font-mono text-lg font-bold ${displayProfit > 0 ? 'text-emerald-600' : displayProfit < 0 ? 'text-red-600' : 'text-slate-600'}` },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <span className="text-slate-700 text-sm font-medium">{item.label}</span>
                <span className={`${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* สรุปยอดย้อนหลัง */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">สรุปยอดย้อนหลัง</h2>
          {deleteError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {deleteError}
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold">
                <th className="px-4 py-3 text-left">วันที่</th>
                <th className="px-4 py-3 text-center">ยอดแทงรวม</th>
                <th className="px-4 py-3 text-center">ยอดผลสรุปรวม</th>
                <th className="px-4 py-3 text-center">กำไร / ขาดทุน</th>
                <th className="px-4 py-3 text-right">จัดการ</th>
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
                    <tr className={`border-b border-slate-200 transition-colors ${si % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50`}>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {editingId === s.id ? (
                          <input
                            type="text"
                            value={editingLabel}
                            onChange={e => setEditingLabel(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : (
                          s.label ?? d
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-yellow-700 font-semibold">{fmt(Number(s.sum_bet))}</td>
                      <td className="px-4 py-3 text-center font-mono text-amber-700 font-semibold">
                        {fmt(Number(s.sum_result))}
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-bold text-lg ${p > 0 ? 'text-emerald-600' : p < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        {p >= 0 ? `+${fmt(p)}` : fmt(p)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          {editingId === s.id ? (
                            <>
                              <button
                                onClick={() => saveSessionLabel(s.id)}
                                className="text-xs text-green-600 hover:text-green-700 hover:bg-green-100 px-2 py-1 rounded transition-colors"
                                title="บันทึก"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs text-slate-600 hover:text-slate-700 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                                title="ยกเลิก"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => { setEditingId(s.id); setEditingLabel(s.label ?? d); }}
                                className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                                title="แก้ไข"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => saveSessionImage(s.id, sRows, s.label ?? d)}
                                disabled={savingImageId === s.id}
                                className="text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100 px-2 py-1 rounded transition-colors disabled:opacity-40"
                                title="บันทึกรูป"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setExpandedSession(isOpen ? null : s.id)}
                                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors"
                              >
                                {isOpen ? 'ซ่อน' : 'ดู'}
                                <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteSession(s.id)}
                                disabled={deletingId === s.id}
                                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-100 px-2 py-1 rounded transition-colors disabled:opacity-40"
                                title="ลบ"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-slate-200">
                        <td colSpan={5} className="px-0 py-0 bg-slate-100">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-amber-200 bg-amber-50 text-amber-900 font-semibold">
                                <th className="px-6 py-2 text-left w-8">#</th>
                                <th className="px-4 py-2 text-left">ชื่อ</th>
                                <th className="px-4 py-2 text-center">ราคาน้ำ</th>
                                <th className="px-4 py-2 text-center">สกอร์(ก่อน)</th>
                                <th className="px-4 py-2 text-center">สกอร์(จบ)</th>
                                <th className="px-4 py-2 text-center">แทง</th>
                                <th className="px-4 py-2 text-center">ผลลัพธ์</th>
                                <th className="px-4 py-2 text-center">ผลสรุป</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {sRows.map((row, i) => {
                                const sv = calcSummary(row);
                                return (
                                  <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-slate-100`}>
                                    <td className="px-6 py-2 text-slate-600 font-medium">{i + 1}</td>
                                    <td className="px-4 py-2 text-slate-900 font-medium">{row.name}</td>
                                    <td className="px-4 py-2 text-center"><span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-semibold text-xs">{row.odds}</span></td>
                                    <td className="px-4 py-2 text-center text-slate-600 font-mono">{row.score || '—'}</td>
                                    <td className="px-4 py-2 text-center text-slate-900 font-mono font-semibold">{row.scoreFinal || '—'}</td>
                                    <td className="px-4 py-2 text-center font-mono text-slate-900 font-semibold">{Number(row.betAmount) > 0 ? fmt(Number(row.betAmount)) : '—'}</td>
                                    <td className="px-4 py-2 text-center">
                                      {row.result ? <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${RESULT_BG[row.result]}`}>{RESULT_LABELS[row.result]}</span> : <span className="text-slate-500">—</span>}
                                    </td>
                                    <td className="px-4 py-2 text-center font-mono font-semibold">
                                      <span className={sv !== null && sv > 0 ? 'text-emerald-600' : sv === 0 ? 'text-red-600' : 'text-slate-600'}>
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
              <tr className="border-t-2 border-blue-200 bg-blue-50 text-xs font-bold">
                <td className="px-4 py-3 text-blue-700">รวมทั้งหมด</td>
                <td className="px-4 py-3 text-center font-mono text-yellow-700">{fmt(sessSumBet)}</td>
                <td className="px-4 py-3 text-center font-mono text-amber-700">{fmt(sessSumResult)}</td>
                <td className={`px-4 py-3 text-center font-mono text-lg ${sessProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {sessProfit >= 0 ? `+${fmt(sessProfit)}` : fmt(sessProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* รายการทั้งหมด (latest session) */}
      {displayRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">รายการทั้งหมด</h2>
            <span className="text-xs text-slate-600">จาก session ล่าสุด: {sessions[0]?.label}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold">
                  <th className="px-4 py-3 text-left w-8">#</th>
                  <th className="px-4 py-3 text-left">ชื่อ</th>
                  <th className="px-4 py-3 text-center">ราคาน้ำ</th>
                  <th className="px-4 py-3 text-center">สกอร์(ก่อน)</th>
                  <th className="px-4 py-3 text-center">สกอร์(จบ)</th>
                  <th className="px-4 py-3 text-center">แทง</th>
                  <th className="px-4 py-3 text-center">ผลลัพธ์</th>
                  <th className="px-4 py-3 text-center">ผลสรุป</th>
                  <th className="px-4 py-3 text-center">กำไร/ขาดทุน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayRows.map((row, i) => {
                  const sv  = displaySummaries[i];
                  const bet = Number(row.betAmount) || 0;
                  const pnl = sv !== null ? r2(bet - sv) : null;
                  return (
                    <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}>
                      <td className="px-4 py-2.5 text-slate-600 text-xs font-medium">{i + 1}</td>
                      <td className="px-4 py-2.5 text-slate-700 font-medium whitespace-nowrap">{row.name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono text-xs font-semibold">{row.odds}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.score ? <span className="text-slate-700 font-mono text-xs">{row.score}</span> : <span className="text-slate-500 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.scoreFinal ? <span className="text-yellow-700 font-mono text-xs font-semibold">{row.scoreFinal}</span> : <span className="text-slate-500 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="font-mono text-xs text-yellow-700 font-semibold">{bet > 0 ? fmt(bet) : '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.result
                          ? <span className={`px-2 py-0.5 rounded text-xs font-semibold ${RESULT_BG[row.result]}`}>{RESULT_LABELS[row.result]}</span>
                          : <span className="text-slate-500 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-mono text-xs font-bold ${sv !== null && sv > 0 ? 'text-emerald-600' : sv === 0 ? 'text-red-600' : 'text-slate-600'}`}>
                          {sv !== null ? fmt(sv) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-mono text-xs font-bold ${pnl !== null && pnl > 0 ? 'text-emerald-600' : pnl !== null && pnl < 0 ? 'text-red-600' : 'text-slate-600'}`}>
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
