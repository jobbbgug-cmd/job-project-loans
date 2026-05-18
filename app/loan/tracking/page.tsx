'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TrackingEntry {
  id: number;
  loan_id: number;
  loan_number: string;
  customer_name: string;
  installment_no: number;
  due_date: string;
  due_amount: number;
  principal_component: number;
  interest_component: number;
  status: string;
  loan_principal: number;
  loan_paid_amount: number;
}

type Period = 'overdue' | 'month' | '30days' | 'all';

const PERIODS: { value: Period; label: string; desc: string }[] = [
  { value: 'overdue', label: 'เกินกำหนด', desc: 'ที่ยังไม่ชำระและเลยวันครบกำหนดแล้ว' },
  { value: 'month',   label: 'เดือนนี้',  desc: 'ครบกำหนดภายในเดือนนี้ (รวมที่ค้างอยู่)' },
  { value: '30days',  label: '30 วัน',    desc: 'ครบกำหนดใน 30 วันข้างหน้า' },
  { value: 'all',     label: 'ทั้งหมด',   desc: 'ทุกงวดที่ยังไม่ชำระ' },
];

function fmt(n: number) { return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n); }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }

function daysOverdue(dueDateStr: string): number {
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export default function TrackingPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [entries, setEntries] = useState<TrackingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/loan/tracking?period=${period}`)
      .then(r => r.json().catch(() => []))
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false); });
  }, [period]);

  const overdueCount = entries.filter(e => daysOverdue(e.due_date) > 0).length;
  // Sum remaining balance per unique loan (principal - paid) to avoid double-counting multi-installment loans
  const totalAmount = Object.values(
    entries.reduce<Record<number, number>>((acc, e) => {
      if (!(e.loan_id in acc)) acc[e.loan_id] = Math.max(0, Number(e.loan_principal) - Number(e.loan_paid_amount));
      return acc;
    }, {})
  ).reduce((s, v) => s + v, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">ติดตามการชำระ</h1>
        <p className="text-slate-400 text-sm mt-0.5">รายการงวดที่ต้องติดตามให้ลูกค้ามาชำระ</p>
      </div>

      {/* Period filter */}
      <div className="flex gap-2 flex-wrap">
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p.value ? 'bg-yellow-600 !text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}`}>
            {p.label}
            {p.value === 'overdue' && overdueCount > 0 && !loading && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{overdueCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-slate-400 text-xs mb-1">งวดทั้งหมด</p>
          <p className="text-white font-bold text-2xl">{loading ? '—' : entries.length}</p>
          <p className="text-slate-500 text-xs mt-0.5">งวด</p>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-slate-400 text-xs mb-1">ยอดรวม</p>
          <p className="text-yellow-400 font-bold text-lg">{loading ? '—' : `฿${fmt(totalAmount)}`}</p>
          <p className="text-slate-500 text-xs mt-0.5">ที่ต้องชำระ</p>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-slate-400 text-xs mb-1">เกินกำหนด</p>
          <p className={`font-bold text-2xl ${!loading && overdueCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {loading ? '—' : overdueCount}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">งวด</p>
        </div>
      </div>

      {loading && (
        <div className="text-slate-400 text-sm py-8 text-center">กำลังโหลด…</div>
      )}

      {!loading && entries.length === 0 && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-10 text-center">
          <p className="text-slate-400 text-sm">ไม่มีรายการในช่วงนี้</p>
        </div>
      )}

      {/* Mobile cards */}
      {!loading && entries.length > 0 && (
        <>
          <div className="space-y-3 lg:hidden">
            {entries.map(e => {
              const days = daysOverdue(e.due_date);
              const isOverdue = days > 0;
              const remaining = Math.max(0, Number(e.loan_principal) - Number(e.loan_paid_amount));
              return (
                <div key={e.id} className={`bg-slate-800 rounded-xl border p-4 space-y-3 ${isOverdue ? 'border-red-500/40 bg-red-500/5' : 'border-slate-700'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">{e.customer_name}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{e.loan_number} · งวดที่ {e.installment_no}</p>
                    </div>
                    {isOverdue
                      ? <span className="px-2 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 flex-shrink-0 whitespace-nowrap">เกิน {days} วัน</span>
                      : <span className="px-2 py-1 rounded-lg text-xs font-medium bg-yellow-500/20 text-yellow-400 flex-shrink-0">รอชำระ</span>
                    }
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-slate-400 text-xs">วันครบกำหนด</p>
                      <p className={`mt-0.5 font-medium ${isOverdue ? 'text-red-400' : 'text-white'}`}>{fmtDate(e.due_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-xs">ยอดที่ต้องชำระ</p>
                      <p className="text-white font-bold text-base mt-0.5">฿{fmt(remaining)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-slate-700">
                    <Link href={`/loan/loans/${e.loan_id}`}
                      className="flex-1 text-center bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-xs font-medium transition-colors">
                      ดูสินเชื่อ
                    </Link>
                    <Link href={`/loan/payments/new?loan_id=${e.loan_id}`}
                      className="flex-1 text-center bg-yellow-600 hover:bg-yellow-500 !text-white py-2 rounded-lg text-xs font-medium transition-colors">
                      บันทึกชำระ
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  <th className="text-left px-5 py-3 text-slate-400 font-medium">ลูกค้า</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">สินเชื่อ</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">งวด</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">วันครบกำหนด</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">ยอดที่ต้องชำระ</th>
                  <th className="text-center px-4 py-3 text-slate-400 font-medium">สถานะ</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {entries.map(e => {
                  const days = daysOverdue(e.due_date);
                  const isOverdue = days > 0;
                  const remaining = Math.max(0, Number(e.loan_principal) - Number(e.loan_paid_amount));
                  return (
                    <tr key={e.id} className={`hover:bg-slate-700/30 transition-colors ${isOverdue ? 'bg-red-500/5' : ''}`}>
                      <td className="px-5 py-3.5 text-white font-medium">{e.customer_name}</td>
                      <td className="px-4 py-3.5 text-slate-300 font-mono text-xs">{e.loan_number}</td>
                      <td className="px-4 py-3.5 text-slate-300">งวดที่ {e.installment_no}</td>
                      <td className="px-4 py-3.5">
                        <span className={isOverdue ? 'text-red-400 font-medium' : 'text-white'}>{fmtDate(e.due_date)}</span>
                        {isOverdue && <span className="ml-2 text-xs text-red-400/70">เกิน {days} วัน</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right text-white font-semibold font-mono">฿{fmt(remaining)}</td>
                      <td className="px-4 py-3.5 text-center">
                        {isOverdue
                          ? <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-400">เกินกำหนด</span>
                          : <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-yellow-500/20 text-yellow-400">รอชำระ</span>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          <Link href={`/loan/loans/${e.loan_id}`}
                            className="text-slate-400 hover:text-white text-xs transition-colors whitespace-nowrap">
                            ดูสินเชื่อ
                          </Link>
                          <Link href={`/loan/payments/new?loan_id=${e.loan_id}`}
                            className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 !text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap">
                            บันทึกชำระ
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
