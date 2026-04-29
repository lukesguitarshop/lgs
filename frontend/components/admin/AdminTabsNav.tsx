'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, TrendingDown, DollarSign, ArrowLeftRight } from 'lucide-react';

const TABS = [
  { href: '/admin', label: 'Operations', icon: Settings },
  { href: '/deal-finder', label: 'Deal Finder', icon: TrendingDown },
  { href: '/finances', label: 'Finances', icon: DollarSign },
  { href: '/admin/trade-ins', label: 'Trade-Ins', icon: ArrowLeftRight },
];

export function AdminTabsNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-base font-medium border transition-colors ${
              active
                ? 'bg-[#6E0114] text-[#FFFFF3] border-[#6E0114] hover:bg-[#580110]'
                : 'bg-[#FFFFF3] text-[#020E1C] border-gray-300 hover:border-[#6E0114] hover:text-[#6E0114]'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
