'use client';

import { useState, useEffect, useRef } from 'react';
import ThaiDatePicker from '@/components/ThaiDatePicker';

interface Row {
  date: string;
  name: string;
  handicap: string;
  odds: string;
  score: string;
  scoreFinal: string;
  betAmount: string;
  result: string;
}

function todayStr() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function fmtDate(d: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const STORAGE_KEY = 'parser_saved_rows';

function parseLine(line: string): Row | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) return null;

  const name = trimmed.slice(0, lastSpace).trim();
  const data = trimmed.slice(lastSpace + 1).trim();

  const slashIdx = data.indexOf('/');
  if (slashIdx === -1) return null;

  const handicap   = data.slice(0, slashIdx);
  const afterSlash = data.slice(slashIdx + 1);
  const parenOpen  = afterSlash.indexOf('(');
  const parenClose = afterSlash.indexOf(')');

  const odds  = parenOpen === -1 ? afterSlash : afterSlash.slice(0, parenOpen);
  const score = parenOpen !== -1 && parenClose > parenOpen
    ? afterSlash.slice(parenOpen + 1, parenClose)
    : '';

  if (!name || !handicap || !odds) return null;
  return { date: todayStr(), name, handicap, odds, score, scoreFinal: '', betAmount: '', result: '' };
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function r2(n: number) { return Math.round(n * 100) / 100; }

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

function fmtSummary(val: number | null): string {
  if (val === null) return '—';
  return val.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const RESULT_OPTIONS = [
  { value: '', label: 'ยังไม่ระบุ' },
  { value: 'win_full', label: 'ชนะเต็ม' },
  { value: 'win_half', label: 'ชนะครึ่ง' },
  { value: 'lose_full', label: 'แพ้เต็ม' },
  { value: 'lose_half', label: 'แพ้ครึ่ง' },
  { value: 'draw', label: 'เสมอทุน' },
];

const RESULT_STYLES: Record<string, string> = {
  win_full:  'bg-emerald-500/15 text-emerald-400',
  win_half:  'bg-emerald-500/10 text-emerald-300',
  lose_full: 'bg-red-500/15 text-red-400',
  lose_half: 'bg-red-500/10 text-red-300',
  draw:      'bg-yellow-500/15 text-yellow-400',
  '':        'bg-slate-700/50 text-slate-400',
};

function parseBetAmountLine(line: string): { name: string; amount: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const eqIdx = trimmed.lastIndexOf('=');
  if (eqIdx === -1) return null;
  const rawName = trimmed.slice(0, eqIdx).trim();
  const amount  = trimmed.slice(eqIdx + 1).trim();
  if (!rawName || !amount || isNaN(Number(amount))) return null;
  // strip leading "ต่อ" prefix if present
  const name = rawName.startsWith('ต่อ') ? rawName.slice(3).trim() : rawName;
  return { name, amount };
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function nameSimilar(a: string, b: string): boolean {
  if (a.includes(b) || b.includes(a)) return true;
  const minLen = Math.min(a.length, b.length);
  const threshold = minLen >= 5 ? 2 : 1;
  return levenshtein(a, b) <= threshold;
}

export default function ParserPage() {
  const [input, setInput]           = useState('');
  const [betInput, setBetInput]     = useState('');
  const [matchMsg, setMatchMsg]     = useState<string | null>(null);
  const [rows, setRows]             = useState<Row[]>([]);
  const [errors, setErrors]         = useState<string[]>([]);
  const [copied, setCopied]         = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm]     = useState<Row>({ date: todayStr(), name: '', handicap: '', odds: '', score: '', scoreFinal: '', betAmount: '', result: '' });
  const [saved, setSaved]           = useState(false);
  const [newCount, setNewCount]     = useState(0);
  const [transferAmount, setTransferAmount] = useState('');
  const [archiving, setArchiving]   = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const [fetchingLine, setFetchingLine] = useState(false);
  const [lineMsg, setLineMsg] = useState<string | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage on mount; if empty, fall back to server draft
  useEffect(() => {
    async function loadDraft() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const storedTransfer = localStorage.getItem(STORAGE_KEY + '_transfer');
        if (stored) {
          const localRows = JSON.parse(stored) as Row[];
          setRows(localRows);
          if (storedTransfer) setTransferAmount(storedTransfer);
          // push local data to server so other devices can see it
          fetch('/api/loan/parser-draft', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: localRows, transfer_amount: storedTransfer ?? '' }),
          }).catch(() => {});
          return;
        }
      } catch { /* ignore */ }
      // localStorage empty — try server draft
      try {
        const res = await fetch('/api/loan/parser-draft');
        if (res.ok) {
          const draft = await res.json();
          if (draft && Array.isArray(draft.rows) && draft.rows.length > 0) {
            setRows(draft.rows);
            if (draft.transfer_amount) setTransferAmount(draft.transfer_amount);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(draft.rows));
              if (draft.transfer_amount) localStorage.setItem(STORAGE_KEY + '_transfer', draft.transfer_amount);
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
    }
    loadDraft();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function parse() {
    const lines  = input.split('\n');
    const parsed: Row[]  = [];
    const errs: string[] = [];

    lines.forEach((line, i) => {
      if (!line.trim()) return;
      const result = parseLine(line);
      if (result) parsed.push(result);
      else errs.push(`บรรทัด ${i + 1}: "${line.trim()}" — ไม่สามารถแยกได้`);
    });

    setRows(prev => [...prev, ...parsed]);
    setErrors(errs);
    setEditingIdx(null);
    setInput('');
    setSaved(false);
    setNewCount(parsed.length);
  }

  function matchBets() {
    const entries: { name: string; amount: string }[] = [];
    betInput.split('\n').forEach(line => {
      const r = parseBetAmountLine(line);
      if (r) entries.push(r);
    });
    if (!entries.length) return;

    let matched = 0;
    const updated = rows.map(row => {
      if (row.betAmount && Number(row.betAmount) > 0) return row;
      const found = entries.find(e => nameSimilar(row.name, e.name));
      if (found) { matched++; return { ...row, betAmount: found.amount }; }
      return row;
    });
    setRows(updated);
    setSaved(false);
    setMatchMsg(`จับคู่ได้ ${matched} จาก ${entries.length} รายการ`);
    setTimeout(() => setMatchMsg(null), 3000);
  }

  function syncToServer(r: Row[], transfer: string) {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      fetch('/api/loan/parser-draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: r, transfer_amount: transfer }),
      }).catch(() => {});
    }, 1500);
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
      localStorage.setItem(STORAGE_KEY + '_transfer', transferAmount);
    } catch { /* ignore */ }
    syncToServer(rows, transferAmount);
    setSaved(true);
    setNewCount(0);
    setTimeout(() => setSaved(false), 2000);
  }

  async function archiveSession() {
    if (rows.length === 0) return;
    setArchiving(true);
    setArchiveError('');
    const sumBet    = r2(rows.reduce((s, r) => s + (Number(r.betAmount) || 0), 0));
    const sumResult = r2(rows.reduce((s, r) => { const v = calcSummary(r); return s + (v ?? 0); }, 0));
    const profit    = r2(sumBet - sumResult);
    const label     = `สรุปวันที่ ${fmtDate(todayStr())}`;
    try {
      const res = await fetch('/api/loan/parser-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, rows_data: rows, sum_bet: sumBet, sum_result: sumResult, profit }),
      });
      if (res.ok) {
        setRows([]);
        setErrors([]);
        setEditingIdx(null);
        setSaved(false);
        setNewCount(0);
        setTransferAmount('');
        setConfirmArchive(false);
        setArchiveError('');
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_KEY + '_transfer');
        } catch { /* ignore */ }
        fetch('/api/loan/parser-draft', { method: 'DELETE' }).catch(() => {});
      } else {
        const data = await res.json().catch(() => ({}));
        setArchiveError(data.error || `บันทึกไม่สำเร็จ (${res.status})`);
      }
    } catch {
      setArchiveError('เกิดข้อผิดพลาด — ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setArchiving(false);
    }
  }

  function clearAll() {
    setRows([]);
    setErrors([]);
    setEditingIdx(null);
    setSaved(false);
    setNewCount(0);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  async function fetchLineMessages() {
    setFetchingLine(true);
    setLineMsg(null);
    try {
      const res = await fetch('/api/loan/line-messages');
      const data = await res.json().catch(() => ([])) as { id: number; display_name: string | null; message: string }[];
      if (!Array.isArray(data) || data.length === 0) {
        setLineMsg('ไม่มีข้อความใหม่จาก LINE');
        return;
      }
      const text = data.map(d => d.message).join('\n');
      setInput(prev => prev ? prev + '\n' + text : text);
      setLineMsg(`ดึงได้ ${data.length} ข้อความ`);
      // mark as used
      await fetch('/api/loan/line-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: data.map(d => d.id) }),
      });
    } catch {
      setLineMsg('เกิดข้อผิดพลาด');
    } finally {
      setFetchingLine(false);
      setTimeout(() => setLineMsg(null), 3000);
    }
  }

  function handleCopy(label: string, text: string) {
    copyText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  function deleteRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i));
    setSaved(false);
    if (editingIdx === i) setEditingIdx(null);
    else if (editingIdx !== null && editingIdx > i) setEditingIdx(editingIdx - 1);
  }

  function startEdit(i: number) {
    setEditForm({ ...rows[i] });
    setEditingIdx(i);
  }

  function saveEdit() {
    if (editingIdx === null) return;
    setRows(prev => { const a = [...prev]; a[editingIdx] = { ...editForm }; return a; });
    setEditingIdx(null);
    setSaved(false);
  }

  function cancelEdit() { setEditingIdx(null); }

  function updateCell(i: number, field: keyof Row, value: string) {
    setRows(prev => { const a = [...prev]; a[i] = { ...a[i], [field]: value }; return a; });
    setSaved(false);
  }

  async function saveAsImage() {
    if (rows.length === 0) return;
    setSavingImage(true);
    try {
      const scale  = 2;
      const pad    = 10;
      const rowH   = 38;
      const headH  = 42;
      const footH  = 42;
      const font   = 'system-ui,-apple-system,sans-serif';

      const cols = [
        { label: '#',            width: 36,  align: 'center' as const },
        { label: 'วันที่',       width: 90,  align: 'left'   as const },
        { label: 'ชื่อ',         width: 150, align: 'left'   as const },
        { label: 'ราคาต่อ',     width: 78,  align: 'center' as const },
        { label: 'ราคาน้ำ',     width: 72,  align: 'center' as const },
        { label: 'สกอร์(ก่อน)', width: 92,  align: 'center' as const },
        { label: 'สกอร์(จบ)',   width: 88,  align: 'center' as const },
        { label: 'จำนวนแทง',    width: 110, align: 'right'  as const },
        { label: 'ผลลัพธ์',     width: 90,  align: 'center' as const },
        { label: 'ผลสรุป',      width: 90,  align: 'right'  as const },
      ];

      const totalW = cols.reduce((s, c) => s + c.width, 0);
      const totalH = headH + rowH * rows.length + footH;

      const canvas = document.createElement('canvas');
      canvas.width  = totalW * scale;
      canvas.height = totalH * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);

      const fill  = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
      const hline = (y: number, color: string, lw = 0.5) => { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(totalW, y); ctx.stroke(); };
      const txt   = (s: string, x: number, y: number, color: string, size = 12, bold = false, align: 'left'|'center'|'right' = 'left', maxW?: number) => {
        ctx.fillStyle = color; ctx.font = `${bold ? '600 ' : ''}${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
        maxW ? ctx.fillText(s, x, y, maxW) : ctx.fillText(s, x, y);
      };
      const cx = (col: typeof cols[number], x0: number) =>
        col.align === 'center' ? x0 + col.width / 2 : col.align === 'right' ? x0 + col.width - pad : x0 + pad;

      // ── Background ────────────────────────────────────────────────────────
      fill(0, 0, totalW, totalH, '#1e293b');

      // ── Header ────────────────────────────────────────────────────────────
      fill(0, 0, totalW, headH, '#0f172a');
      let x0 = 0;
      cols.forEach(col => {
        txt(col.label, cx(col, x0), headH / 2, '#94a3b8', 11, true, col.align, col.width - pad * 2);
        x0 += col.width;
      });
      hline(headH, '#334155', 1);

      // ── Rows ──────────────────────────────────────────────────────────────
      const RLABEL: Record<string, string> = { win_full:'ชนะเต็ม', win_half:'ชนะครึ่ง', lose_full:'แพ้เต็ม', lose_half:'แพ้ครึ่ง', draw:'เสมอทุน', '':'—' };
      const rcol   = (r: string) => r.startsWith('win') ? '#10b981' : r.startsWith('lose') ? '#ef4444' : r==='draw' ? '#eab308' : '#475569';

      rows.forEach((row, i) => {
        const y  = headH + i * rowH;
        fill(0, y, totalW, rowH, i % 2 === 0 ? '#1e293b' : '#1b2a3b');
        const sv = calcSummary(row);
        const cells: [string, string, boolean?, CanvasTextAlign?][] = [
          [String(i + 1),                                                               '#64748b'],
          [row.date ? fmtDate(row.date) : '—',                                         '#cbd5e1'],
          [row.name,                                                                    '#f1f5f9', true],
          [row.handicap || '—',                                                         '#fbbf24'],
          [row.odds || '—',                                                             '#60a5fa'],
          [row.score || '—',                                                            '#34d399'],
          [row.scoreFinal || '—',                                                       '#94a3b8'],
          [row.betAmount ? Number(row.betAmount).toLocaleString('th-TH') : '—',        '#f1f5f9'],
          [RLABEL[row.result] ?? '—',                                                   rcol(row.result)],
          [sv !== null ? sv.toLocaleString('th-TH', {maximumFractionDigits:2}) : '—', sv !== null ? (sv > 0 ? '#10b981' : '#ef4444') : '#475569'],
        ];
        x0 = 0;
        cells.forEach(([val, color, bold], ci) => {
          txt(val, cx(cols[ci], x0), y + rowH / 2, color, 12, !!bold, cols[ci].align, cols[ci].width - pad);
          x0 += cols[ci].width;
        });
        hline(y + rowH, '#283548', 0.5);
      });

      // ── Footer ────────────────────────────────────────────────────────────
      const fy = headH + rows.length * rowH;
      fill(0, fy, totalW, footH, '#0f172a');
      hline(fy, '#475569', 1.5);

      const spanW = cols.slice(0, 9).reduce((s, c) => s + c.width, 0);
      txt('รวม', pad, fy + footH / 2, '#94a3b8', 12, true);

      const hasSummary = rows.some(r => r.result);
      txt(hasSummary ? sumSummary.toLocaleString('th-TH', {maximumFractionDigits:2}) : '—', spanW + cols[9].width - pad, fy + footH / 2, hasSummary ? (sumSummary > 0 ? '#10b981' : '#ef4444') : '#475569', 12, true, 'right');

      // ── Download ──────────────────────────────────────────────────────────
      const link = document.createElement('a');
      link.download = `parser-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('saveAsImage:', err);
    } finally {
      setSavingImage(false);
    }
  }

  const sumBet     = r2(rows.reduce((s, r) => s + (Number(r.betAmount) || 0), 0));
  const sumSummary = r2(rows.reduce((s, r) => { const v = calcSummary(r); return s + (v ?? 0); }, 0));

  const archiveReady = rows.length > 0
    && rows.every(r => Number(r.betAmount) > 0)
    && rows.every(r => r.result !== '')
    && Number(transferAmount) > 0;

  const archiveBlockReason = rows.length === 0 ? null
    : !rows.every(r => Number(r.betAmount) > 0) ? 'กรุณาระบุจำนวนเงินที่แทงให้ครบทุกรายการ'
    : !rows.every(r => r.result !== '') ? 'กรุณาระบุผลลัพธ์ให้ครบทุกรายการ'
    : Number(transferAmount) <= 0 ? 'กรุณาระบุจำนวนเงินที่โอนเข้ามาในแถวรวม'
    : null;

  const RESULT_LABEL_MAP: Record<string, string> = {
    win_full: 'ชนะเต็ม', win_half: 'ชนะครึ่ง',
    lose_full: 'แพ้เต็ม', lose_half: 'แพ้ครึ่ง',
    draw: 'เสมอทุน', '': 'ยังไม่ระบุ',
  };

  const fullCopyText = rows.length > 0
    ? [
        ['วันที่', 'ชื่อ', 'ราคาต่อ', 'ราคาน้ำ', 'สกอร์(ก่อน)', 'สกอร์(จบ)', 'จำนวนเงินที่แทง', 'ผลลัพธ์', 'ผลสรุป'].join('\t'),
        ...rows.map(r => {
          const sv = calcSummary(r);
          return [
            r.date ? fmtDate(r.date) : '',
            r.name,
            r.handicap,
            r.odds,
            r.score || '-',
            r.scoreFinal || '-',
            r.betAmount || '0',
            RESULT_LABEL_MAP[r.result] ?? r.result,
            sv !== null ? String(sv) : '-',
          ].join('\t');
        }),
      ].join('\n')
    : '';

  return (
    <div className="space-y-6 text-white">
      <div className="max-w-5xl space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">แยกข้อมูล</h1>
          <p className="text-slate-400 text-sm mt-1">
            วางข้อมูลในรูปแบบ <span className="font-mono text-yellow-400">ชื่อ ราคาต่อ/ราคาน้ำ(สกอร์)</span> ทีละบรรทัด
          </p>
        </div>

        {/* Two input boxes side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Left: ข้อมูลดิบ */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">ข้อมูลดิบ</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchLineMessages}
                  disabled={fetchingLine}
                  className="flex items-center gap-1.5 text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                >
                  {fetchingLine ? (
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  ) : (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M19.952 1.651a.75.75 0 01.298.844l-7.5 21a.75.75 0 01-1.407-.042l-2.41-7.81-7.81-2.41a.75.75 0 01-.042-1.407l21-7.5a.75.75 0 01.871.325z"/></svg>
                  )}
                  ดึงจาก LINE
                </button>
                <button
                  type="button"
                  onClick={() => { setInput(''); setErrors([]); setNewCount(0); }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ล้าง
                </button>
              </div>
            </div>
            {lineMsg && (
              <p className={`text-xs ${lineMsg.startsWith('ไม่มี') || lineMsg.startsWith('เกิด') ? 'text-slate-400' : 'text-green-400'}`}>{lineMsg}</p>
            )}
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); setNewCount(0); }}
              rows={8}
              placeholder={`เซลติก 0.5-1/1.78(1-2)\nประจวบ 0/1.65(2-0)\nชาบาห์ 0.5/2.00(0-1)\nเชลต้าบีโก้ 0-0.5/1.99(2-0)\nราชบุรี 0.5-1/1.95(3-0)\nเฟเยนูร์ด 1/2.00`}
              className="flex-1 w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none font-mono leading-relaxed"
            />
            <button
              onClick={parse}
              disabled={!input.trim()}
              className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              แยกข้อมูล
            </button>
            {newCount > 0 && (
              <p className="text-yellow-400 text-xs">เพิ่ม {newCount} รายการลงตารางแล้ว — กด <span className="font-semibold">บันทึก</span> เพื่อให้ข้อมูลไม่หาย</p>
            )}
          </div>

          {/* Right: ข้อมูลจำนวนเงินที่แทง */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">ข้อมูลจำนวนเงินที่แทง</label>
              <button
                type="button"
                onClick={() => { setBetInput(''); setMatchMsg(null); }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                ล้าง
              </button>
            </div>
            <textarea
              value={betInput}
              onChange={e => { setBetInput(e.target.value); setMatchMsg(null); }}
              rows={8}
              placeholder={`ต่อเชลติก=200\nต่อประจวบ=100\nต่อชาบาห์=200\nต่อเชลต้าบีโก้=200\nต่อราชบุรี=200\nต่อเฟเยนูร์ด=200`}
              className="flex-1 w-full rounded-xl bg-slate-700 border border-slate-600 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none font-mono leading-relaxed"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={matchBets}
                disabled={!betInput.trim() || rows.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                จับคู่จำนวนเงิน
              </button>
            </div>
            {matchMsg && (
              <p className="text-yellow-400 text-xs font-medium">{matchMsg}</p>
            )}
          </div>
        </div>

        {/* Save button row */}
        <div className="flex items-center gap-3">
          <button
            onClick={saveToStorage}
            disabled={rows.length === 0}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 ${
              saved ? 'bg-yellow-700 text-yellow-200' : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
            }`}
          >
            {saved ? (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>บันทึกแล้ว</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>บันทึก</>
            )}
          </button>
          <p className="text-slate-500 text-xs">กด บันทึก เพื่อเก็บข้อมูลไว้ใช้ครั้งหน้า</p>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="text-red-400 text-xs font-mono">{e}</p>
            ))}
          </div>
        )}

        {/* Table */}
        {rows.length > 0 && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">ตารางข้อมูล ({rows.length} รายการ)</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveAsImage}
                  disabled={savingImage}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-yellow-400 border border-slate-600 hover:border-yellow-500/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingImage ? (
                    <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>กำลังบันทึก…</>
                  ) : (
                    <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>บันทึกรูป</>
                  )}
                </button>
                <button
                  onClick={() => handleCopy('table', fullCopyText)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {copied === 'table' ? (
                    <><svg className="w-3 h-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-yellow-400">คัดลอกแล้ว</span></>
                  ) : (
                    <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>คัดลอกทั้งหมด</>
                  )}
                </button>
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 border border-slate-700 hover:border-red-500/40 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  ล้างตาราง
                </button>
              </div>
            </div>
            {/* ── Mobile cards ─────────────────────────────────────────── */}
            <div className="md:hidden divide-y divide-slate-700/50">
              {rows.map((row, i) => {
                const sv = calcSummary(row);
                return (
                  <div key={i} className="px-4 py-3 space-y-2.5">
                    {/* Name + delete */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">{i + 1}</span>
                        <p className="text-white font-medium text-sm truncate">{row.name}</p>
                      </div>
                      <button onClick={() => deleteRow(i)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    {/* ราคาต่อ · ราคาน้ำ · สกอร์(ก่อน) labels */}
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div>
                        <p className="text-slate-500 text-xs">ราคาต่อ</p>
                        <span className="text-yellow-400 text-xs font-mono font-semibold">{row.handicap || '—'}</span>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">ราคาน้ำ</p>
                        <span className="text-blue-400 text-xs font-mono font-semibold">{row.odds || '—'}</span>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">สกอร์(ก่อน)</p>
                        <span className="text-emerald-400 text-xs font-mono font-semibold">{row.score || '—'}</span>
                      </div>
                    </div>
                    {/* สกอร์(จบ) + จำนวนเงิน + ผลลัพธ์ — one row */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <p className="text-slate-500 text-xs mb-1">สกอร์(จบ)</p>
                        <input value={row.scoreFinal} onChange={e => updateCell(i, 'scoreFinal', e.target.value)}
                          placeholder="0-0" className="w-full rounded-lg bg-slate-700 border border-slate-600 px-2 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-yellow-500 text-center font-mono" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">จำนวนเงิน</p>
                        <input type="number" min={0} value={row.betAmount} onChange={e => updateCell(i, 'betAmount', e.target.value)}
                          placeholder="0" className="w-full rounded-lg bg-slate-700 border border-slate-600 px-2 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 text-center font-mono" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">ผลลัพธ์</p>
                        <select value={row.result} onChange={e => updateCell(i, 'result', e.target.value)}
                          className={`w-full rounded-lg px-1 py-2 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-yellow-500 ${RESULT_STYLES[row.result] ?? RESULT_STYLES['']}`}>
                          {RESULT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* ผลสรุป */}
                    {sv !== null && (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-400">ผลสรุป</span>
                        <span className={`font-mono text-base font-bold ${row.result === 'draw' ? 'text-yellow-400' : sv > 0 ? 'text-emerald-400' : sv === 0 ? 'text-red-400' : 'text-slate-300'}`}>
                          ฿{fmtSummary(sv)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Mobile totals */}
              <div className="border-t-2 border-slate-600 bg-slate-700/30 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm font-medium">รวมเงินที่แทง</span>
                  <span className="font-mono text-white font-semibold">{sumBet > 0 ? sumBet.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400 text-sm font-medium shrink-0">เงินที่โอนเข้ามา</span>
                  <input type="number" min={0} value={transferAmount} onChange={e => setTransferAmount(e.target.value)}
                    placeholder="0" className="w-32 bg-slate-600 border border-slate-500 rounded-lg px-3 py-1.5 text-sm text-white text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                {rows.some(r => r.result) && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm font-medium">ผลสรุปรวม</span>
                    <span className={`font-mono font-bold text-lg ${sumSummary > 0 ? 'text-emerald-400' : sumSummary === 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {sumSummary.toLocaleString('th-TH', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Desktop table ─────────────────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-xs">
                    <th className="px-3 py-3 text-left font-medium w-8">#</th>
                    <th className="px-3 py-3 text-left font-medium w-px">วันที่</th>
                    <th className="px-3 py-3 text-left font-medium">ชื่อ</th>
                    <th className="px-3 py-3 text-center font-medium">ราคาต่อ</th>
                    <th className="px-3 py-3 text-center font-medium">ราคาน้ำ</th>
                    <th className="px-3 py-3 text-center font-medium">สกอร์(ก่อน)</th>
                    <th className="px-3 py-3 text-center font-medium w-px">สกอร์(จบ)</th>
                    <th className="px-3 py-3 text-center font-medium w-px">จำนวนเงินที่แทง</th>
                    <th className="px-3 py-3 text-center font-medium">ผลลัพธ์</th>
                    <th className="px-3 py-3 text-center font-medium">ผลสรุป</th>
                    <th className="px-3 py-3 text-center font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {rows.map((row, i) => {
                    const isEditing = editingIdx === i;
                    return (
                      <tr key={i} className={`transition-colors whitespace-nowrap ${isEditing ? 'bg-slate-700/50' : 'hover:bg-slate-700/30'}`}>
                        <td className="px-3 py-2.5 text-slate-500 text-xs">{i + 1}</td>

                        {isEditing ? (
                          <>
                            <td className="px-3 py-2">
                              <ThaiDatePicker value={editForm.date} onChange={v => setEditForm(f => ({ ...f, date: v }))} className="text-xs" />
                            </td>
                            <td className="px-3 py-2">
                              <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500" />
                            </td>
                            <td className="px-3 py-2">
                              <input value={editForm.handicap} onChange={e => setEditForm(f => ({ ...f, handicap: e.target.value }))}
                                className="w-20 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 text-center font-mono" />
                            </td>
                            <td className="px-3 py-2">
                              <input value={editForm.odds} onChange={e => setEditForm(f => ({ ...f, odds: e.target.value }))}
                                className="w-20 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 text-center font-mono" />
                            </td>
                            <td className="px-3 py-2">
                              <input value={editForm.score} onChange={e => setEditForm(f => ({ ...f, score: e.target.value }))}
                                className="w-20 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 text-center font-mono" />
                            </td>
                            <td className="px-3 py-2">
                              <input value={editForm.scoreFinal} onChange={e => setEditForm(f => ({ ...f, scoreFinal: e.target.value }))}
                                placeholder="0-0" className="w-20 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 text-center font-mono" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min={0} value={editForm.betAmount} onChange={e => setEditForm(f => ({ ...f, betAmount: e.target.value }))}
                                placeholder="0" className="w-24 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 text-center font-mono" />
                            </td>
                            <td className="px-3 py-2">
                              <select value={editForm.result} onChange={e => setEditForm(f => ({ ...f, result: e.target.value }))}
                                className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500">
                                {RESULT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {(() => { const v = calcSummary(editForm); return v === null ? <span className="text-slate-600 text-xs">—</span> : <span className={`font-mono text-xs font-semibold ${editForm.result === 'draw' ? 'text-yellow-400' : v > 0 ? 'text-emerald-400' : v === 0 ? 'text-red-400' : 'text-slate-300'}`}>{fmtSummary(v)}</span>; })()}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5 justify-center">
                                <button onClick={saveEdit} className="p-1 rounded bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40 transition-colors" title="บันทึก">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </button>
                                <button onClick={cancelEdit} className="p-1 rounded bg-slate-600/50 text-slate-400 hover:bg-slate-600 transition-colors" title="ยกเลิก">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2.5">
                              <ThaiDatePicker value={row.date} onChange={v => updateCell(i, 'date', v)} className="text-xs" />
                            </td>
                            <td className="px-3 py-2.5 text-white font-medium">{row.name}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded font-mono text-xs">{row.handicap}</span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded font-mono text-xs">{row.odds}</span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {row.score
                                ? <span className="bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded font-mono text-xs">{row.score}</span>
                                : <span className="text-slate-600 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <input value={row.scoreFinal} onChange={e => updateCell(i, 'scoreFinal', e.target.value)}
                                placeholder="0-0" className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-yellow-500 text-center font-mono" />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <input type="number" min={0} value={row.betAmount} onChange={e => updateCell(i, 'betAmount', e.target.value)}
                                placeholder="0" className="w-24 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 text-center font-mono" />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <select value={row.result} onChange={e => updateCell(i, 'result', e.target.value)}
                                className={`rounded px-2 py-1 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-yellow-500 ${RESULT_STYLES[row.result] ?? RESULT_STYLES['']}`}>
                                {RESULT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {(() => { const v = calcSummary(row); return v === null ? <span className="text-slate-600 text-xs">—</span> : <span className={`font-mono text-xs font-semibold ${row.result === 'draw' ? 'text-yellow-400' : v > 0 ? 'text-emerald-400' : v === 0 ? 'text-red-400' : 'text-slate-300'}`}>{fmtSummary(v)}</span>; })()}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5 justify-center">
                                <button onClick={() => startEdit(i)} className="p-1 rounded text-slate-400 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors" title="แก้ไข">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button onClick={() => deleteRow(i)} className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="ลบ">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-600 bg-slate-700/40 text-xs font-semibold">
                    {/* # + วันที่ + ชื่อ + ราคาต่อ + ราคาน้ำ + สกอร์(ก่อน) + สกอร์(จบ) */}
                    <td className="px-3 py-3 text-slate-400" colSpan={7}>รวม</td>
                    {/* จำนวนเงินที่แทง */}
                    <td className="px-3 py-3 text-center">
                      <span className="font-mono text-white">{sumBet > 0 ? sumBet.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—'}</span>
                    </td>
                    {/* ผลลัพธ์ — input จำนวนเงินที่โอนเข้ามา */}
                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        value={transferAmount}
                        onChange={e => setTransferAmount(e.target.value)}
                        placeholder="เงินที่โอนเข้ามา"
                        className="w-32 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center font-mono"
                      />
                    </td>
                    {/* ผลสรุป */}
                    <td className="px-3 py-3 text-center">
                      <span className={`font-mono ${sumSummary > 0 ? 'text-emerald-400' : sumSummary === 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {rows.some(r => r.result) ? sumSummary.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—'}
                      </span>
                    </td>
                    {/* actions */}
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Archive button */}
        {rows.length > 0 && (
          <div className={`border rounded-2xl p-5 space-y-3 ${archiveReady ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-slate-700 bg-slate-800/50'}`}>
            {!confirmArchive ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold text-sm">สรุปผลประจำวัน</p>
                    <p className="text-slate-400 text-xs mt-0.5">บันทึกข้อมูลทั้งหมดลงฐานข้อมูล แล้วล้างหน้าเพื่อเริ่มรอบใหม่</p>
                  </div>
                  <button
                    onClick={() => setConfirmArchive(true)}
                    disabled={!archiveReady}
                    className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed !text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                    สรุปผลประจำวัน
                  </button>
                </div>
                {archiveBlockReason && (
                  <p className="text-yellow-400/80 text-xs flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    {archiveBlockReason}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-yellow-400 text-sm font-semibold">ยืนยันการสรุปผลประจำวัน?</p>
                <p className="text-slate-400 text-xs">ข้อมูล {rows.length} รายการจะถูกบันทึกลงฐานข้อมูลและล้างออกจากหน้านี้</p>
                {archiveError && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {archiveError}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={archiveSession}
                    disabled={archiving}
                    className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 !text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors"
                  >
                    {archiving ? 'กำลังบันทึก...' : 'ยืนยัน — บันทึกและล้างข้อมูล'}
                  </button>
                  <button
                    onClick={() => setConfirmArchive(false)}
                    className="px-5 py-2 rounded-xl text-sm text-slate-400 hover:text-white border border-slate-700 transition-colors"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
