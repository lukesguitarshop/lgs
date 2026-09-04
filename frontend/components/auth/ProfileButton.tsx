'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { User, LogOut, Heart, Tag, MessageSquare, Shield, Bell, Guitar } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { fetchNotifications, NotificationCounts } from '@/lib/notifications';

export function ProfileButton() {
  const { user, isAuthenticated, isAdmin, isLoading, setShowLoginModal, logout } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({ offers: 0, messages: 0, total: 0 });

  const loadNotifications = useCallback(async () => {
    try {
      const result = await fetchNotifications();
      setCounts(result.counts);
    } catch {
      // Silently fail
    }
  }, []);

  // Initial load and polling
  useEffect(() => {
    if (!isAuthenticated) {
      // Signing out has to zero the badge; there is no external system to read it from.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCounts({ offers: 0, messages: 0, total: 0 });
      return;
    }

    loadNotifications();

    // Poll every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, loadNotifications]);

  if (isLoading) {
    return (
      <div className="h-9 w-9 rounded-lg bg-primary/50 animate-pulse" />
    );
  }

  if (!isAuthenticated) {
    return (
      <Button
        onClick={() => setShowLoginModal(true)}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Sign In
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 p-0"
        >
          <User className="h-5 w-5" />
          {counts.total > 0 && (
            <span className="absolute -top-2 -right-2 bg-foreground text-background text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {counts.total > 99 ? '99+' : counts.total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-background">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.fullName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Notifications Section - only for customers */}
        {!isAdmin && counts.total > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1">
              <Bell className="h-3 w-3" />
              Notifications
            </DropdownMenuLabel>
            {counts.offers > 0 && (
              <DropdownMenuItem asChild>
                <Link href="/messages?filter=offers" className="cursor-pointer">
                  <Tag className="mr-2 h-4 w-4 text-primary" />
                  <span className="flex-1">Offers</span>
                  <span className="ml-auto bg-primary/8 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                    {counts.offers} pending
                  </span>
                </Link>
              </DropdownMenuItem>
            )}
            {counts.messages > 0 && (
              <DropdownMenuItem asChild>
                <Link href="/messages" className="cursor-pointer">
                  <MessageSquare className="mr-2 h-4 w-4 text-foreground/60" />
                  <span className="flex-1">Messages</span>
                  <span className="ml-auto bg-foreground/8 text-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                    {counts.messages} unread
                  </span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        {!isAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/favorites" className="cursor-pointer">
                <Heart className="mr-2 h-4 w-4" />
                Favorites
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/messages?filter=offers" className="cursor-pointer">
                <Tag className="mr-2 h-4 w-4" />
                My Offers
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/messages" className="cursor-pointer">
                <MessageSquare className="mr-2 h-4 w-4" />
                Messages
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/trade-ins" className="cursor-pointer">
                <Guitar className="mr-2 h-4 w-4" />
                My Trade-Ins
              </Link>
            </DropdownMenuItem>
          </>
        )}
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="cursor-pointer">
              <Shield className="mr-2 h-4 w-4" />
              Admin Portal
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="cursor-pointer text-primary focus:text-primary"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface MobileProfileButtonProps {
  onNavigate?: () => void;
}

/** One 48px row of the menu sheet's account block; hairlines between rows, none above the first. */
const mobileRowClass =
  'flex h-12 w-full items-center justify-between border-t border-foreground/10 px-5 text-left text-[15px] text-foreground transition-colors hover:text-primary cursor-pointer first:border-t-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring';

const mobileCountClass = 'font-mono text-[11px] text-muted-foreground';

/**
 * The account block at the foot of the phone menu sheet. Plain 48px rows in the sheet's
 * own weight — no filled slabs, no coloured pills — so the trade-in CTA above it stays
 * the sheet's one call to action.
 */
export function MobileProfileButton({ onNavigate }: MobileProfileButtonProps) {
  const { user, isAuthenticated, isAdmin, isLoading, setShowLoginModal, logout } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({ offers: 0, messages: 0, total: 0 });

  const loadNotifications = useCallback(async () => {
    try {
      const result = await fetchNotifications();
      setCounts(result.counts);
    } catch {
      // Silently fail
    }
  }, []);

  // Initial load and polling
  useEffect(() => {
    if (!isAuthenticated) {
      // Signing out has to zero the badge; there is no external system to read it from.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCounts({ offers: 0, messages: 0, total: 0 });
      return;
    }

    loadNotifications();

    // Poll every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, loadNotifications]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => {
          setShowLoginModal(true);
          onNavigate?.();
        }}
        className={mobileRowClass}
      >
        Sign in
      </button>
    );
  }

  return (
    <>
      <p className="label-mono-sm px-5 pt-4 pb-2 text-foreground/55">
        Signed in as {user?.fullName}
      </p>
      <Link href="/profile" onClick={onNavigate} className={mobileRowClass}>
        Profile
      </Link>
      {!isAdmin && (
        <>
          <Link href="/messages" onClick={onNavigate} className={mobileRowClass}>
            Messages
            {counts.messages > 0 && (
              <span className={mobileCountClass}>{counts.messages} unread</span>
            )}
          </Link>
          <Link href="/messages?filter=offers" onClick={onNavigate} className={mobileRowClass}>
            My offers
            {counts.offers > 0 && (
              <span className={mobileCountClass}>{counts.offers} pending</span>
            )}
          </Link>
          <Link href="/account/trade-ins" onClick={onNavigate} className={mobileRowClass}>
            My trade-ins
          </Link>
        </>
      )}
      {isAdmin && (
        <Link href="/admin" onClick={onNavigate} className={mobileRowClass}>
          Admin portal
        </Link>
      )}
      <button
        type="button"
        onClick={() => {
          logout();
          onNavigate?.();
        }}
        className={mobileRowClass}
      >
        Sign out
      </button>
    </>
  );
}
