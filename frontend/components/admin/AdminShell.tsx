'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowUpRight, CornerDownLeft, LogOut, Menu, Search, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  ADMIN_NAV,
  SELLER_NAV,
  isNavItemActive,
  setAdminTab,
  useAdminTabs,
  type AdminNavGroup,
  type AdminNavItem,
  type BadgeKey,
} from '@/lib/admin-nav';

/**
 * Frame for the admin area, replacing what used to be a row of five page tabs above a
 * row of five sub-tabs. A bar across the top shows the current location (`.admin-bar`).
 * From 1024px up every destination is listed in a sidebar beside it (`.admin-desk`) and
 * the bar carries a jump-to palette; below that the bar carries a hamburger that opens
 * the same navigation as a drawer.
 *
 * globals.css shows both only for the owner (`.viewer-admin` on <html>, set before first
 * paint). Anyone else who lands on an admin URL gets the storefront header and a plain
 * centred <main>.
 */

type Badges = Record<BadgeKey, number>;

/**
 * Everything that differs between the owner's back office and a guest seller's portal.
 * The frame, sidebar, drawer, bar and palette are the same components for both.
 */
interface Portal {
  id: 'admin' | 'seller';
  nav: AdminNavGroup[];
  home: string;
  onHome?: () => void;
  /** Under the shop name in the sidebar. */
  tagline: string;
  /** Under the signed-in name. */
  role: string;
  menuLabel: string;
  fallback: Location;
  palettePlaceholder: string;
  loadBadges: () => Promise<Badges>;
}

const ADMIN_PORTAL: Portal = {
  id: 'admin',
  nav: ADMIN_NAV,
  home: '/admin',
  onHome: () => setAdminTab('operations', 'listings'),
  tagline: 'Back office',
  role: 'Owner',
  menuLabel: 'Admin',
  fallback: { group: 'Admin', label: 'Back office' },
  palettePlaceholder: 'Jump to orders, flip calculator, snippets…',
  loadBadges: async () => {
    const [conversations, offers] = await Promise.all([
      api.authGet<{ unreadCount: number }[]>('/messages/conversations'),
      api.authGet<{ offerStatus: string | null }[]>('/admin/conversation-offers'),
    ]);
    return {
      messages: conversations.reduce((sum, c) => sum + c.unreadCount, 0),
      offers: offers.filter((o) => o.offerStatus === 'active').length,
    };
  },
};

const SELLER_PORTAL: Portal = {
  id: 'seller',
  nav: SELLER_NAV,
  home: '/seller',
  tagline: 'Seller portal',
  role: 'Seller',
  menuLabel: 'Seller',
  fallback: { group: 'Seller', label: 'Seller portal' },
  palettePlaceholder: 'Jump to listings, messages…',
  loadBadges: async () => {
    const conversations = await api.authGet<{ unreadCount: number }[]>('/seller/conversations');
    return { messages: conversations.reduce((sum, c) => sum + c.unreadCount, 0), offers: 0 };
  },
};

const BADGE_STYLE: Record<BadgeKey, string> = {
  messages: 'bg-background text-foreground',
  offers: 'bg-amber-400 text-foreground',
};

function useBadges(enabled: boolean, portal: Portal): Badges {
  const [badges, setBadges] = useState<Badges>({ messages: 0, offers: 0 });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const next = await portal.loadBadges();
        if (cancelled) return;
        setBadges(next);
      } catch {
        // Counts are a convenience; a failed poll leaves the last known ones.
      }
    };
    load();
    const interval = setInterval(load, 60000);
    window.addEventListener('focus', load);
    // A page that just changed what is unread (a thread was opened) can ask for a recount.
    window.addEventListener('portal-badges-stale', load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', load);
      window.removeEventListener('portal-badges-stale', load);
    };
  }, [enabled, portal]);

  return badges;
}

function go(item: AdminNavItem) {
  if (item.section && item.tab) setAdminTab(item.section, item.tab);
}

interface Location {
  group: string;
  label: string;
}

function useLocation(portal: Portal): Location {
  const pathname = usePathname();
  const tabs = useAdminTabs();
  for (const group of portal.nav) {
    const item = group.items.find((i) => isNavItemActive(i, pathname, tabs));
    if (item) return { group: group.label, label: item.label };
  }
  return portal.fallback;
}

export function AdminFrame({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  return (
    <PortalFrame portal={ADMIN_PORTAL} enabled={isAdmin}>
      {children}
    </PortalFrame>
  );
}

/** The same shell around /seller routes, for a guest seller. */
export function SellerFrame({ children }: { children: React.ReactNode }) {
  const { isSeller } = useAuth();
  return (
    <PortalFrame portal={SELLER_PORTAL} enabled={isSeller}>
      {children}
    </PortalFrame>
  );
}

function PortalFrame({ portal, enabled, children }: { portal: Portal; enabled: boolean; children: React.ReactNode }) {
  const badges = useBadges(enabled, portal);
  const location = useLocation(portal);

  return (
    <div className="admin-frame flex flex-grow flex-col lg:flex-row" data-portal={portal.id}>
      <aside className="admin-desk sticky top-0 h-screen w-[248px] shrink-0 flex-col bg-foreground text-background">
        <AdminNav portal={portal} badges={badges} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminBar portal={portal} badges={badges} location={location} />
        <main className="admin-main flex-grow container mx-auto px-5 py-6 md:px-4 md:py-8">{children}</main>
      </div>
    </div>
  );
}

/**
 * Brand, the grouped destinations, and the account row. Shared by the desktop sidebar
 * and the phone drawer; `touch` gives the rows 44px targets, and `onNavigate` lets the
 * drawer close itself when a destination is picked.
 */
function AdminNav({
  portal,
  badges,
  touch = false,
  onNavigate,
  brandAction,
}: {
  portal: Portal;
  badges: Badges;
  touch?: boolean;
  onNavigate?: () => void;
  brandAction?: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabs = useAdminTabs();
  const { user, logout } = useAuth();

  const name = user?.fullName || user?.email || portal.role;
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const row = touch ? 'h-11 gap-3 px-3 text-[15px]' : 'h-8 gap-2.5 px-2.5 text-[13.5px]';

  return (
    <>
      <div className="flex items-start">
        <Link
          href={portal.home}
          onClick={() => {
            portal.onHome?.();
            onNavigate?.();
          }}
          className="block min-w-0 flex-1 px-5 pb-5 pt-6"
        >
          <span className="font-heading block text-[22px] uppercase leading-none tracking-[0.02em]">
            Luke&rsquo;s Guitar Shop
          </span>
          <span className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-background/50">
            <span className="h-1.5 w-1.5 bg-primary ring-1 ring-background/30" />
            {portal.tagline}
          </span>
        </Link>
        {brandAction}
      </div>

      <nav
        aria-label={portal.menuLabel}
        className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4 [scrollbar-color:rgb(255_255_243/0.18)_transparent] [scrollbar-width:thin]"
      >
        {portal.nav.map((group) => (
          <div key={group.label} className="mt-[18px] first:mt-1">
            <p className="px-2 pb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-background/40">
              {group.label}
            </p>
            <ul className="space-y-px">
              {group.items.map((item) => {
                const active = isNavItemActive(item, pathname, tabs);
                const count = item.badge ? badges[item.badge] : 0;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => {
                        go(item);
                        onNavigate?.();
                      }}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70 ${row} ${
                        active
                          ? 'bg-primary font-semibold text-background'
                          : 'text-background/70 hover:bg-background/[0.07] hover:text-background'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${active ? '' : 'text-background/45 group-hover:text-background/80'}`}
                        strokeWidth={active ? 2.25 : 1.75}
                      />
                      <span className="truncate">{item.label}</span>
                      {count > 0 && item.badge && (
                        <span
                          className={`ml-auto min-w-[20px] rounded-full px-1.5 text-center font-mono text-[11px] font-semibold leading-[18px] ${BADGE_STYLE[item.badge]}`}
                        >
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-background/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          href="/"
          onClick={onNavigate}
          className={`flex items-center text-background/70 transition-colors hover:bg-background/[0.07] hover:text-background ${row}`}
        >
          <ArrowUpRight className="h-4 w-4 text-background/45" strokeWidth={1.75} />
          View storefront
        </Link>
        <div className={`mt-2 flex items-center py-1.5 ${touch ? 'gap-3 px-3' : 'gap-2.5 px-2.5'}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-background/10 font-mono text-[11px] font-semibold">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium leading-tight">{name}</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-background/45">{portal.role}</span>
          </span>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className={`flex items-center justify-center text-background/50 transition-colors hover:bg-background/10 hover:text-background ${
              touch ? 'h-11 w-11' : 'h-8 w-8'
            }`}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * One bar for every width, so the page has a single <h1>. On phones it is the dark strip
 * with the hamburger; from 1024px up the hamburger goes (the sidebar is always there),
 * the bar turns light and the jump-to palette appears.
 */
function AdminBar({ portal, badges, location }: { portal: Portal; badges: Badges; location: Location }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const waiting = badges.messages + badges.offers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        // The palette is a desktop control; leave the shortcut alone where it is hidden.
        if (!window.matchMedia('(min-width: 1024px)').matches) return;
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="admin-bar sticky top-0 z-40 h-14 items-center gap-1 bg-foreground pl-1.5 pr-4 text-background lg:h-[60px] lg:gap-6 lg:border-b lg:border-border lg:bg-background/95 lg:px-8 lg:text-foreground lg:backdrop-blur-sm">
      <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogPrimitive.Trigger
          aria-label={
            waiting > 0
              ? `Open ${portal.menuLabel.toLowerCase()} menu, ${waiting} waiting`
              : `Open ${portal.menuLabel.toLowerCase()} menu`
          }
          className="relative flex h-11 w-11 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70 lg:hidden"
        >
          <Menu className="h-6 w-6" strokeWidth={1.75} />
          {waiting > 0 && (
            <span className="absolute right-1.5 top-2 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-foreground" />
          )}
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/55 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col bg-foreground text-background shadow-[8px_0_40px_rgba(2,14,28,0.45)] duration-200 focus:outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">{portal.menuLabel} menu</DialogPrimitive.Title>
            <AdminNav
              portal={portal}
              badges={badges}
              touch
              onNavigate={() => setMenuOpen(false)}
              brandAction={
                <DialogPrimitive.Close
                  aria-label="Close menu"
                  className="mr-1.5 mt-3 flex h-11 w-11 shrink-0 items-center justify-center text-background/60 hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70"
                >
                  <X className="h-5 w-5" />
                </DialogPrimitive.Close>
              }
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-3">
        <span className="font-mono text-[9.5px] uppercase leading-none tracking-[0.2em] opacity-50 lg:text-[11px] lg:tracking-[0.18em] lg:opacity-45">
          {location.group}
        </span>
        <span className="hidden opacity-25 lg:inline">/</span>
        <h1 className="font-heading truncate text-[19px] uppercase leading-none tracking-[0.02em] lg:text-[22px]">
          {location.label}
        </h1>
      </div>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="ml-auto hidden h-9 w-[280px] items-center gap-2.5 border border-border bg-muted/60 px-3 text-left text-[13px] text-foreground/55 transition-colors hover:border-foreground/40 hover:text-foreground lg:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1">Jump to…</span>
        <kbd className="border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-foreground/60">
          Ctrl K
        </kbd>
      </button>

      <CommandPalette portal={portal} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

interface Command {
  id: string;
  label: string;
  group: string;
  icon: AdminNavItem['icon'];
  run: () => void;
}

function CommandPalette({
  portal,
  open,
  onOpenChange,
}: {
  portal: Portal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[18vh] z-50 w-[560px] max-w-[calc(100vw-2rem)] -translate-x-1/2 border border-foreground/30 bg-background shadow-[0_24px_60px_-12px_rgba(2,14,28,0.45)] focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Jump to a page</DialogPrimitive.Title>
          <PaletteBody portal={portal} close={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Mounted only while the palette is open, so the query and cursor start fresh each time.
function PaletteBody({ portal, close }: { portal: Portal; close: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const nav = portal.nav.flatMap((group) =>
      group.items.map((item) => ({
        id: item.id,
        label: item.label,
        group: group.label,
        icon: item.icon,
        run: () => {
          go(item);
          router.push(item.href);
        },
      })),
    );
    return [
      ...nav,
      {
        id: 'storefront',
        label: 'View storefront',
        group: 'Site',
        icon: ArrowUpRight,
        run: () => router.push('/'),
      },
      {
        id: 'sold',
        label: 'Sold archive',
        group: 'Site',
        icon: ArrowUpRight,
        run: () => router.push('/sold'),
      },
    ];
  }, [router, portal]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.group}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    close();
    command.run();
  };

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="h-4 w-4 text-foreground/45" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(results[cursor]);
            }
          }}
          placeholder={portal.palettePlaceholder}
          className="h-[52px] flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-foreground/40"
        />
        <kbd className="border border-border px-1.5 py-0.5 font-mono text-[10px] text-foreground/50">Esc</kbd>
      </div>
      <ul ref={listRef} className="max-h-[360px] overflow-y-auto p-2">
        {results.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-foreground/50">Nothing matches &ldquo;{query}&rdquo;</li>
        )}
        {results.map((command, index) => {
          const Icon = command.icon;
          const active = index === cursor;
          return (
            <li key={command.id}>
              <button
                type="button"
                data-active={active}
                onMouseMove={() => setCursor(index)}
                onClick={() => run(command)}
                className={`flex h-10 w-full items-center gap-3 px-3 text-left text-[14px] ${
                  active ? 'bg-foreground text-background' : 'text-foreground'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${active ? 'text-background/70' : 'text-foreground/45'}`}
                  strokeWidth={1.75}
                />
                <span className="flex-1 truncate">{command.label}</span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
                    active ? 'text-background/55' : 'text-foreground/40'
                  }`}
                >
                  {command.group}
                </span>
                {active && <CornerDownLeft className="h-3.5 w-3.5 text-background/60" />}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
