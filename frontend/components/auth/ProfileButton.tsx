'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { User, LogOut, Heart, Tag, MessageSquare, Shield, Bell } from 'lucide-react';
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
    if (!isAuthenticated) {
      setCounts({ offers: 0, messages: 0, total: 0 });
      return;
    }

    try {
      const result = await fetchNotifications();
      setCounts(result.counts);
    } catch {
      // Silently fail
    }
  }, [isAuthenticated]);

  // Initial load and polling
  useEffect(() => {
    if (!isAuthenticated) {
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
      <div className="h-9 w-9 rounded-lg bg-[#df5e15]/50 animate-pulse" />
    );
  }

  if (!isAuthenticated) {
    return (
      <Button
        onClick={() => setShowLoginModal(true)}
        className="px-4 py-2 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors"
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
          className="relative h-9 w-9 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] p-0"
        >
          <User className="h-5 w-5" />
          {counts.total > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {counts.total > 99 ? '99+' : counts.total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-white">
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
                <Link href="/offers" className="cursor-pointer">
                  <Tag className="mr-2 h-4 w-4 text-orange-500" />
                  <span className="flex-1">Offers</span>
                  <span className="ml-auto bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    {counts.offers} pending
                  </span>
                </Link>
              </DropdownMenuItem>
            )}
            {counts.messages > 0 && (
              <DropdownMenuItem asChild>
                <Link href="/messages" className="cursor-pointer">
                  <MessageSquare className="mr-2 h-4 w-4 text-blue-500" />
                  <span className="flex-1">Messages</span>
                  <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
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
              <Link href="/offers" className="cursor-pointer">
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
          className="cursor-pointer text-red-600 focus:text-red-600"
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

export function MobileProfileButton({ onNavigate }: MobileProfileButtonProps) {
  const { user, isAuthenticated, isAdmin, isLoading, setShowLoginModal, logout } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({ offers: 0, messages: 0, total: 0 });

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setCounts({ offers: 0, messages: 0, total: 0 });
      return;
    }

    try {
      const result = await fetchNotifications();
      setCounts(result.counts);
    } catch {
      // Silently fail
    }
  }, [isAuthenticated]);

  // Initial load and polling
  useEffect(() => {
    if (!isAuthenticated) {
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
        onClick={() => {
          setShowLoginModal(true);
          onNavigate?.();
        }}
        className="w-full px-4 py-3 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors text-center cursor-pointer"
      >
        Sign In
      </button>
    );
  }

  return (
    <>
      <div className="px-4 py-2 text-sm text-muted-foreground border-t border-border mt-2 pt-2">
        Signed in as <span className="font-medium text-foreground">{user?.fullName}</span>
      </div>
      {/* Notifications Section - only for customers */}
      {!isAdmin && counts.total > 0 && (
        <div className="px-4 py-2 mb-2 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <Bell className="h-3 w-3" />
            Notifications
          </div>
          <div className="flex gap-2">
            {counts.offers > 0 && (
              <Link
                href="/offers"
                onClick={onNavigate}
                className="flex-1 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium text-center cursor-pointer"
              >
                <Tag className="h-4 w-4 inline mr-1" />
                {counts.offers} offers
              </Link>
            )}
            {counts.messages > 0 && (
              <Link
                href="/messages"
                onClick={onNavigate}
                className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium text-center cursor-pointer"
              >
                <MessageSquare className="h-4 w-4 inline mr-1" />
                {counts.messages} messages
              </Link>
            )}
          </div>
        </div>
      )}
      <Link
        href="/profile"
        onClick={onNavigate}
        className="w-full px-4 py-3 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors text-center flex items-center justify-center gap-2 cursor-pointer"
      >
        <User className="h-4 w-4" />
        Profile
      </Link>
      {!isAdmin && (
        <>
          <Link
            href="/favorites"
            onClick={onNavigate}
            className="w-full px-4 py-3 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors text-center flex items-center justify-center gap-2 cursor-pointer"
          >
            <Heart className="h-4 w-4" />
            Favorites
          </Link>
          <Link
            href="/offers"
            onClick={onNavigate}
            className="w-full px-4 py-3 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors text-center flex items-center justify-center gap-2 cursor-pointer"
          >
            <Tag className="h-4 w-4" />
            My Offers
          </Link>
          <Link
            href="/messages"
            onClick={onNavigate}
            className="w-full px-4 py-3 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors text-center flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageSquare className="h-4 w-4" />
            Messages
          </Link>
        </>
      )}
      {isAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          className="w-full px-4 py-3 rounded-lg bg-[#df5e15] text-white hover:bg-[#c74d12] transition-colors text-center flex items-center justify-center gap-2 cursor-pointer"
        >
          <Shield className="h-4 w-4" />
          Admin Portal
        </Link>
      )}
      <button
        onClick={() => {
          logout();
          onNavigate?.();
        }}
        className="w-full px-4 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-center flex items-center justify-center gap-2 cursor-pointer"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </>
  );
}
