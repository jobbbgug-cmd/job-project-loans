'use client';

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const SEL = 'bg-transparent border-none py-2.5 text-sm text-white focus:outline-none cursor-pointer appearance-none text-center';

interface Props {
  value: string;        // "YYYY-MM-DD" CE
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
}

export default function ThaiDatePicker({ value, onChange, required, className }: Props) {
  const today = new Date();
  const [year, month, day] = value
    ? value.split('-').map(Number)
    : [today.getFullYear(), today.getMonth() + 1, today.getDate()];
  const currentBE = today.getFullYear() + 543;
  const daysInMonth = new Date(year, month, 0).getDate();

  function emit(y: number, m: number, d: number) {
    const maxD = new Date(y, m, 0).getDate();
    const pd = (n: number) => String(n).padStart(2, '0');
    onChange(`${y}-${pd(m)}-${pd(Math.min(d, maxD))}`);
  }

  return (
    <div className={`flex w-full rounded-lg bg-slate-700 border border-slate-600 overflow-hidden focus-within:ring-2 focus-within:ring-yellow-500 divide-x divide-slate-600 ${className ?? ''}`}>
      {/* Day */}
      <select value={day} onChange={e => emit(year, month, Number(e.target.value))} required={required}
        className={`${SEL} w-14 px-1`}>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      {/* Month */}
      <select value={month} onChange={e => emit(year, Number(e.target.value), day)} required={required}
        className={`${SEL} flex-1 px-1`}>
        {THAI_MONTHS.map((name, i) => (
          <option key={i + 1} value={i + 1}>{name}</option>
        ))}
      </select>

      {/* Year BE */}
      <select value={year + 543} onChange={e => emit(Number(e.target.value) - 543, month, day)} required={required}
        className={`${SEL} w-[4.5rem] px-1`}>
        {Array.from({ length: 21 }, (_, i) => currentBE - 5 + i).map(by => (
          <option key={by} value={by}>{by}</option>
        ))}
      </select>
    </div>
  );
}
