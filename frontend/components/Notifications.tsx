'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bell, Tag, MessageSquare, Clock, CheckCircle, ChevronRight, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchNotifications,
  formatTimeAgo,
  formatPrice,
  Notification,
  NotificationCounts,
} from '@/lib/notifications';

export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({ offers: 0, messages: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setCounts({ offers: 0, messages: 0, total: 0 });
      return;
    }

    try {
      const result = await fetchNotifications();
      setNotifications(result.notifications);
      setCounts(result.counts);
    } catch {
      // Silently fail
    }
  }, [isAuthenticated]);

  // Initial load and polling. loadNotifications zeroes the list itself when signed out;
  // there is no external system to read an empty inbox from.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications();
    if (!isAuthenticated) return;

    // Poll every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, loadNotifications]);

  // Load fresh data when dropdown opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && isAuthenticated) {
      setIsLoading(true);
      loadNotifications().finally(() => setIsLoading(false));
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {counts.total > 0 && (
            <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground ring-2 ring-background text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {counts.total > 99 ? '99+' : counts.total}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[480px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Summary badges */}
        {(counts.offers > 0 || counts.messages > 0) && (
          <>
            <div className="px-2 py-2 flex gap-2 flex-wrap">
              {counts.offers > 0 && (
                <span className="label-mono-sm inline-flex items-center gap-1 border border-primary/30 bg-primary/8 px-2 py-1 text-primary">
                  <Tag className="h-3 w-3" />
                  {counts.offers} offer{counts.offers !== 1 ? 's' : ''}
                </span>
              )}
              {counts.messages > 0 && (
                <span className="label-mono-sm inline-flex items-center gap-1 border border-foreground/20 bg-foreground/4 px-2 py-1 text-foreground/70">
                  <MessageSquare className="h-3 w-3" />
                  {counts.messages} message{counts.messages !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Notification list */}
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No new notifications</p>
          </div>
        ) : (
          <>
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </>
        )}

        <DropdownMenuSeparator />

        {/* Footer links */}
        <div className="p-2 flex gap-2">
          <Link href="/messages?filter=offers" className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs">
              <Tag className="h-3 w-3 mr-1" />
              All Offers
            </Button>
          </Link>
          <Link href="/messages" className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              All Messages
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface NotificationItemProps {
  notification: Notification;
}

function NotificationItem({ notification }: NotificationItemProps) {
  if (notification.type === 'offer') {
    return <OfferNotificationItem notification={notification} />;
  }
  return <MessageNotificationItem notification={notification} />;
}

function OfferNotificationItem({ notification }: { notification: Notification & { type: 'offer' } }) {
  const getStatusIcon = () => {
    switch (notification.status) {
      case 'countered':
        return <MessageSquare className="h-4 w-4 text-primary" />;
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-foreground" />;
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-foreground/60" />;
    }
  };

  const getStatusText = () => {
    switch (notification.status) {
      case 'countered':
        return `Counter: ${formatPrice(notification.counterAmount || 0)}`;
      case 'accepted':
        return 'Offer accepted!';
      case 'pending':
      default:
        return `Your offer: ${formatPrice(notification.amount)}`;
    }
  };

  return (
    <Link href={`/messages/${notification.offerId}`}>
      <DropdownMenuItem className={`p-3 cursor-pointer ${notification.isNew ? 'bg-primary/8' : ''}`}>
        <div className="flex gap-3 w-full">
          {/* Image */}
          <div className="photo-panel relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
            {notification.listingImage && (
              <Image
                src={notification.listingImage}
                alt={notification.listingTitle}
                fill
                className="object-cover"
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {getStatusIcon()}
              <span className="text-xs font-medium text-muted-foreground">Offer</span>
              {notification.isNew && (
                <span className="label-mono-sm bg-primary px-1.5 py-0.5 text-primary-foreground">New</span>
              )}
            </div>
            <p className="text-sm font-medium truncate">{notification.listingTitle}</p>
            <p className="text-xs text-muted-foreground">{getStatusText()}</p>
          </div>

          {/* Time + Arrow */}
          <div className="flex flex-col items-end justify-between flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              {formatTimeAgo(notification.updatedAt)}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </DropdownMenuItem>
    </Link>
  );
}

function MessageNotificationItem({ notification }: { notification: Notification & { type: 'message' } }) {
  return (
    <Link href={`/messages/${notification.conversationId}`}>
      <DropdownMenuItem className="p-3 cursor-pointer bg-foreground/4">
        <div className="flex gap-3 w-full">
          {/* Image */}
          <div className="photo-panel relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
            {notification.listingImage && (
              <Image
                src={notification.listingImage}
                alt={notification.listingTitle || 'Conversation'}
                fill
                className="object-cover"
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Message</span>
              {notification.unreadCount > 0 && (
                <span className="label-mono-sm bg-primary px-1.5 py-0.5 text-primary-foreground">
                  {notification.unreadCount}
                </span>
              )}
            </div>
            <p className="text-sm font-medium truncate">{notification.otherUserName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {notification.lastMessage || 'New conversation'}
            </p>
          </div>

          {/* Time + Arrow */}
          <div className="flex flex-col items-end justify-between flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              {formatTimeAgo(notification.lastMessageAt)}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </DropdownMenuItem>
    </Link>
  );
}

// Mobile notification button (simpler, links to dedicated page or shows count)
export function MobileNotificationButton() {
  const { isAuthenticated } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({ offers: 0, messages: 0, total: 0 });

  useEffect(() => {
    if (!isAuthenticated) {
      // Signing out has to zero the badge; there is no external system to read it from.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCounts({ offers: 0, messages: 0, total: 0 });
      return;
    }

    const loadCounts = async () => {
      try {
        const result = await fetchNotifications();
        setCounts(result.counts);
      } catch {
        // Silently fail
      }
    };

    loadCounts();
    const interval = setInterval(loadCounts, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Link
      href="/messages"
      className="relative p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      <Bell className="h-5 w-5" />
      {counts.total > 0 && (
        <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground ring-2 ring-background text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
          {counts.total > 99 ? '99+' : counts.total}
        </span>
      )}
    </Link>
  );
}
