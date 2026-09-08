'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  User,
  LogOut,
  Heart,
  Tag,
  MessageSquare,
  Shield,
  Bell,
  Guitar,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

/** A tile in the account block's grid: a hairline box on the sheet's own cream. */
const accountTile =
  'flex h-11 items-center justify-between gap-2 rounded-[10px] border border-foreground/12 bg-background px-[13px] text-sm text-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

/** "Luke Walden" -> "LW"; a signed-in user always has at least one word. */
function initials(name: string | undefined) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

/**
 * The account block anchored to the foot of the phone menu sheet. It is the one part of
 * the sheet that changes shape with who is looking: signed out gets the two ways in, a
 * buyer gets their four account destinations, and the owner gets the portal.
 */
export function MobileProfileButton({ onNavigate }: MobileProfileButtonProps) {
  const {
    user,
    isAuthenticated,
    isAdmin,
    isLoading,
    setShowLoginModal,
    setShowRegisterModal,
    logout,
  } = useAuth();
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
      <div className="flex flex-col gap-2.5 border-t border-foreground/12 bg-muted-foreground/18 p-[18px]">
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => {
              setShowLoginModal(true);
              onNavigate?.();
            }}
            className="flex h-[50px] flex-1 items-center justify-center rounded-xl bg-foreground text-[15px] font-semibold text-background transition-colors hover:bg-primary cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setShowRegisterModal(true);
              onNavigate?.();
            }}
            className="flex h-[50px] flex-1 items-center justify-center rounded-xl border border-foreground/22 text-[15px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Create account
          </button>
        </div>
        <p className="text-center text-[12.5px] text-foreground/60">
          Sign in to make offers and track trade-ins.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-foreground/12 bg-muted-foreground/18 px-[18px] pt-3.5 pb-[18px]">
      <div className="flex items-center gap-[11px]">
        <span
          aria-hidden
          className={cn(
            'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-sm font-semibold text-background',
            isAdmin ? 'bg-primary' : 'bg-foreground'
          )}
        >
          {initials(user?.fullName)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold text-foreground">
            {user?.fullName}
          </span>
          {isAdmin ? (
            <span className="label-mono-sm self-start rounded border border-primary/35 px-1.5 py-0.5 text-[9.5px] text-primary">
              Owner
            </span>
          ) : (
            <span className="label-mono-sm text-[10px] text-foreground/55">Signed in</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            logout();
            onNavigate?.();
          }}
          className="text-[13.5px] font-semibold text-primary transition-colors hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Sign out
        </button>
      </div>

      {isAdmin ? (
        <>
          <Link
            href="/admin"
            onClick={onNavigate}
            className="flex h-13 items-center justify-between rounded-xl bg-foreground px-4 text-[15px] font-semibold text-background transition-colors hover:bg-primary cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Admin portal
            <span className="flex items-center gap-2.5">
              {counts.offers > 0 && (
                <span className="label-mono-sm text-[10.5px] text-background/70">
                  {counts.offers} new {counts.offers === 1 ? 'offer' : 'offers'}
                </span>
              )}
              <ArrowRight className="h-[18px] w-[18px]" />
            </span>
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/profile" onClick={onNavigate} className={accountTile}>
              Profile
            </Link>
            <Link href="/admin/trade-ins" onClick={onNavigate} className={accountTile}>
              Trade-in inbox
            </Link>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Link href="/profile" onClick={onNavigate} className={accountTile}>
            Profile
          </Link>
          <Link href="/messages" onClick={onNavigate} className={accountTile}>
            Messages
            {counts.messages > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[10.5px] text-primary-foreground">
                {counts.messages > 99 ? '99+' : counts.messages}
              </span>
            )}
          </Link>
          <Link href="/messages?filter=offers" onClick={onNavigate} className={accountTile}>
            My offers
            {counts.offers > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[10.5px] text-primary-foreground">
                {counts.offers}
              </span>
            )}
          </Link>
          <Link href="/account/trade-ins" onClick={onNavigate} className={accountTile}>
            My trade-ins
          </Link>
        </div>
      )}
    </div>
  );
}
