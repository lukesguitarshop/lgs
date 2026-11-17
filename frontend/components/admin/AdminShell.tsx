'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowUpRight, CornerDownLeft, LogOut, Search } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  ADMIN_NAV,
  isNavItemActive,
  setAdminTab,
  useAdminTabs,
  type AdminNavItem,
  type BadgeKey,
} from '@/lib/admin-nav';

/**
 * Desktop frame for the admin area: a sidebar listing every destination (what used to
 * be a row of five page tabs above a row of five sub-tabs) and a slim top bar with the
 * current location and a jump-to palette.
 *
 * Everything here carries `.admin-desk`, which globals.css shows only from 1024px up and
 * only for the owner (`.viewer-admin` on <html>, set before first paint). Phones, and
 * anyone who is not the admin, get the page exactly as it was.
 */

type Badges = Record<BadgeKey, number>;

const BADGE_STYLE: Record<BadgeKey, string> = {
  messages: 'bg-background text-foreground',
  offers: 'bg-amber-400 text-foreground',
};

function useBadges(enabled: boolean): Badges {
  const [badges, setBadges] = useState<Badges>({ messages: 0, offers: 0 });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [conversations, offers] = await Promise.all([
          api.authGet<{ unreadCount: number }[]>('/messages/conversations'),
          api.authGet<{ offerStatus: string | null }[]>('/admin/conversation-offers'),
        ]);
        if (cancelled) return;
        setBadges({
          messages: conversations.reduce((sum, c) => sum + c.unreadCount, 0),
          offers: offers.filter((o) => o.offerStatus === 'active').length,
        });
      } catch {
        // Counts are a convenience; a failed poll leaves the last known ones.
      }
    };
    load();
    const interval = setInterval(load, 60000);
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', load);
    };
  }, [enabled]);

  return badges;
}

function go(item: AdminNavItem) {
  if (item.section && item.tab) setAdminTab(item.section, item.tab);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const tabs = useAdminTabs();
  const { user, isAdmin, logout } = useAuth();
  const badges = useBadges(isAdmin);

  const name = user?.fullName || user?.email || 'Admin';
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="admin-desk sticky top-0 h-screen w-[248px] shrink-0 flex-col bg-foreground text-background">
      <Link href="/admin" onClick={() => setAdminTab('operations', 'listings')} className="block px-5 pb-5 pt-6">
        <span className="font-heading block text-[22px] uppercase leading-none tracking-[0.02em]">
          Luke&rsquo;s Guitar Shop
        </span>
        <span className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-background/50">
          <span className="h-1.5 w-1.5 bg-primary ring-1 ring-background/30" />
          Back office
        </span>
      </Link>

      <nav
        aria-label="Admin"
        className="flex-1 overflow-y-auto px-3 pb-4 [scrollbar-color:rgb(255_255_243/0.18)_transparent] [scrollbar-width:thin]"
      >
        {ADMIN_NAV.map((group) => (
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
                      onClick={() => go(item)}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex h-8 items-center gap-2.5 px-2.5 text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70 ${
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

      <div className="border-t border-background/10 p-3">
        <Link
          href="/"
          className="flex h-[34px] items-center gap-2.5 px-2.5 text-[13.5px] text-background/70 transition-colors hover:bg-background/[0.07] hover:text-background"
        >
          <ArrowUpRight className="h-4 w-4 text-background/45" strokeWidth={1.75} />
          View storefront
        </Link>
        <div className="mt-2 flex items-center gap-2.5 px-2.5 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-background/10 font-mono text-[11px] font-semibold">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium leading-tight">{name}</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-background/45">Owner</span>
          </span>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-8 w-8 items-center justify-center text-background/50 transition-colors hover:bg-background/10 hover:text-background"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AdminTopBar() {
  const pathname = usePathname();
  const tabs = useAdminTabs();
  const [paletteOpen, setPaletteOpen] = useState(false);

  let current: { group: string; item: AdminNavItem } | null = null;
  for (const group of ADMIN_NAV) {
    const item = group.items.find((i) => isNavItemActive(i, pathname, tabs));
    if (item) {
      current = { group: group.label, item };
      break;
    }
  }

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
    <div className="admin-desk sticky top-0 z-40 h-[60px] items-center gap-6 border-b border-border bg-background/95 px-8 backdrop-blur-sm">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/45">
          {current?.group ?? 'Admin'}
        </span>
        <span className="text-foreground/25">/</span>
        <h1 className="font-heading truncate text-[22px] uppercase leading-none tracking-[0.02em] text-foreground">
          {current?.item.label ?? 'Back office'}
        </h1>
      </div>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="ml-auto flex h-9 w-[280px] items-center gap-2.5 border border-border bg-muted/60 px-3 text-left text-[13px] text-foreground/55 transition-colors hover:border-foreground/40 hover:text-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1">Jump to…</span>
        <kbd className="border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-foreground/60">
          Ctrl K
        </kbd>
      </button>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
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

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[18vh] z-50 w-[560px] max-w-[calc(100vw-2rem)] -translate-x-1/2 border border-foreground/30 bg-background shadow-[0_24px_60px_-12px_rgba(2,14,28,0.45)] focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Jump to an admin page</DialogPrimitive.Title>
          <PaletteBody close={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Mounted only while the palette is open, so the query and cursor start fresh each time.
function PaletteBody({ close }: { close: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const nav = ADMIN_NAV.flatMap((group) =>
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
  }, [router]);

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
          placeholder="Jump to orders, flip calculator, snippets…"
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
