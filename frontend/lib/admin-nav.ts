import { useSyncExternalStore } from 'react';
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bookmark,
  Calculator,
  Calendar,
  ChartNoAxesColumn,
  Clipboard,
  CreditCard,
  MessageSquare,
  Package,
  Receipt,
  ReceiptText,
  Star,
  Tag,
  TrendingDown,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * The admin area is five pages, three of which carry their own row of sub-tabs. On
 * desktop the sidebar (AdminShell) lists every destination in one tree, so it has to be
 * able to say "Finances, on the Dashboard tab" from any page. The sub-tab each page is
 * showing therefore lives here rather than in the page's own state: the sidebar writes
 * it, the page reads it, and the phone tab strips keep writing it exactly as before.
 */
export type AdminSection = 'operations' | 'finances' | 'tools';

const STORAGE_KEYS: Record<AdminSection, string> = {
  operations: 'adminActiveTab',
  finances: 'adminFinanceTab',
  tools: 'adminToolsTab',
};

const DEFAULT_TABS: Record<AdminSection, string> = {
  operations: 'listings',
  finances: 'transactions',
  tools: 'snippets',
};

export type BadgeKey = 'messages' | 'offers';

export interface AdminNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /** Set when the destination is a sub-tab of `href` rather than the page itself. */
  section?: AdminSection;
  tab?: string;
  /** Detail routes that belong under this item (path prefixes). */
  also?: string[];
  badge?: BadgeKey;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

const op = (tab: string, label: string, icon: LucideIcon, extra: Partial<AdminNavItem> = {}): AdminNavItem =>
  ({ id: `operations-${tab}`, label, icon, href: '/admin', section: 'operations', tab, ...extra });
const fin = (tab: string, label: string, icon: LucideIcon): AdminNavItem =>
  ({ id: `finances-${tab}`, label, icon, href: '/finances', section: 'finances', tab });
const tool = (tab: string, label: string, icon: LucideIcon, extra: Partial<AdminNavItem> = {}): AdminNavItem =>
  ({ id: `tools-${tab}`, label, icon, href: '/admin/other-tools', section: 'tools', tab, ...extra });

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Operations',
    items: [
      op('listings', 'Listings', Package),
      op('messages', 'Messages', MessageSquare, { badge: 'messages' }),
      op('offers', 'Offers', Tag, { badge: 'offers' }),
      op('orders', 'Orders', Receipt),
      op('users', 'Users', Users, { also: ['/admin/user'] }),
      op('analytics', 'Analytics', ChartNoAxesColumn),
    ],
  },
  {
    label: 'Sourcing',
    items: [
      { id: 'deal-finder', label: 'Deal Finder', icon: TrendingDown, href: '/deal-finder' },
      { id: 'trade-ins', label: 'Trade-Ins', icon: ArrowLeftRight, href: '/admin/trade-ins' },
    ],
  },
  {
    label: 'Finances',
    items: [
      fin('transactions', 'Transactions', Wallet),
      fin('dashboard', 'Dashboard', BarChart3),
      fin('monthly', 'Monthly', Calendar),
      fin('expenses', 'Expenses', ReceiptText),
    ],
  },
  {
    label: 'Tools',
    items: [
      tool('in-person', 'In-Person Sale', CreditCard, { also: ['/admin/in-person'] }),
      tool('snippets', 'Snippets', Clipboard),
      tool('reservations', 'Reservations', Bookmark, { also: ['/admin/reservations'] }),
      tool('review-scraper', 'Review Scraper', Star),
      // Lives on the Finances page (it is a tab there on phones) but reads as a tool.
      fin('flip-calc', 'Flip Calculator', Calculator),
      tool('activity', 'Activity Logs', Activity),
    ],
  },
];

const VALID_TABS: Record<AdminSection, string[]> = { operations: [], finances: [], tools: [] };
for (const group of ADMIN_NAV) {
  for (const item of group.items) {
    if (item.section && item.tab) VALID_TABS[item.section].push(item.tab);
  }
}

export function isAdminTab(section: AdminSection, tab: string | null | undefined): tab is string {
  return !!tab && VALID_TABS[section].includes(tab);
}

/** Routes that get the admin shell on desktop. */
export function isAdminRoute(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/deal-finder' ||
    pathname === '/finances'
  );
}

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + '/');

export function isNavItemActive(
  item: AdminNavItem,
  pathname: string,
  tabs: Record<AdminSection, string>,
): boolean {
  if (item.also?.some((prefix) => under(pathname, prefix))) return true;
  if (item.section) return pathname === item.href && tabs[item.section] === item.tab;
  return under(pathname, item.href);
}

// ---- sub-tab store -------------------------------------------------------------------

let tabs: Record<AdminSection, string> = DEFAULT_TABS;
let hydrated = false;
const listeners = new Set<() => void>();

// Last-used tabs come back from localStorage on the first client read. The server
// snapshot is the defaults, and useSyncExternalStore re-renders after hydration when
// the two differ, so there is no markup mismatch.
function clientSnapshot(): Record<AdminSection, string> {
  if (!hydrated) {
    hydrated = true;
    const restored = { ...DEFAULT_TABS };
    try {
      for (const section of Object.keys(STORAGE_KEYS) as AdminSection[]) {
        const saved = localStorage.getItem(STORAGE_KEYS[section]);
        if (isAdminTab(section, saved)) restored[section] = saved;
      }
    } catch {
      // Storage blocked: the defaults stand.
    }
    tabs = restored;
  }
  return tabs;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setAdminTab(section: AdminSection, tab: string) {
  if (!isAdminTab(section, tab)) return;
  clientSnapshot();
  try {
    localStorage.setItem(STORAGE_KEYS[section], tab);
  } catch {
    // Not persisted; still applies for this visit.
  }
  if (tabs[section] === tab) return;
  tabs = { ...tabs, [section]: tab };
  listeners.forEach((listener) => listener());
}

export function useAdminTabs(): Record<AdminSection, string> {
  return useSyncExternalStore(subscribe, clientSnapshot, () => DEFAULT_TABS);
}

export function useAdminTab(section: AdminSection): string {
  return useAdminTabs()[section];
}
