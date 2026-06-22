'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, TrendingDown, DollarSign, ArrowLeftRight, Hammer } from 'lucide-react';

const TABS = [
  { href: '/admin', label: 'Operations', icon: Settings },
  { href: '/deal-finder', label: 'Deal Finder', icon: TrendingDown },
  { href: '/finances', label: 'Finances', icon: DollarSign },
  { href: '/admin/trade-ins', label: 'Trade-Ins', icon: ArrowLeftRight },
  { href: '/admin/other-tools', label: 'Other Tools', icon: Hammer },
];

export function AdminTabsNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="grid w-full grid-cols-5 gap-1 rounded-lg bg-muted p-1 mb-4">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`font-nav inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1 text-sm transition-all ${
              active
                ? 'bg-[#6E0114] text-[#FFFFF3] shadow'
                : 'text-[#020E1C]/60 hover:text-[#020E1C]'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
