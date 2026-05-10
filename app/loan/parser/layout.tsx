'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'แยกข้อมูล', href: '/loan/parser' },
  { label: 'แดชบอร์ด', href: '/loan/parser/dashboard' },
];

export default function ParserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-700">
        {TABS.map(tab => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? 'border-yellow-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
