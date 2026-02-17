// Notifications utility for aggregating offers, messages, and favorites notifications

import api from './api';
import { getAuthHeaders } from './auth';

export interface OfferNotification {
  id: string;
  type: 'offer';
  offerId: string;
  listingId: string;
  listingTitle: string;
  listingImage: string | null;
  status: 'pending' | 'countered' | 'accepted' | 'rejected';
  amount: number;
  counterAmount: number | null;
  createdAt: string;
  updatedAt: string;
  isNew: boolean; // Has counter-offer or status change
}

export interface MessageNotification {
  id: string;
  type: 'message';
  conversationId: string;
  otherUserName: string;
  listingTitle: string | null;
  listingImage: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export type Notification = OfferNotification | MessageNotification;

export interface NotificationCounts {
  offers: number; // Pending or countered offers requiring attention
  messages: number; // Unread messages
  total: number;
}

// API response types
interface OfferResponse {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  initialOfferAmount: number;
  currentOfferAmount: number;
  counterOfferAmount: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  listing: {
    id: string;
    listingTitle: string;
    price: number;
    currency: string;
    condition: string | null;
    image: string | null;
    disabled: boolean;
  } | null;
}

interface ConversationResponse {
  id: string;
  otherUserId: string | null;
  otherUserName: string;
  listingId: string | null;
  listingTitle: string | null;
  listingImage: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  unreadCount: number;
}

interface UnreadCountResponse {
  unreadCount: number;
}

/**
 * Fetch all notifications for the current user
 */
export async function fetchNotifications(): Promise<{
  notifications: Notification[];
  counts: NotificationCounts;
}> {
  const headers = getAuthHeaders();

  // Fetch offers and messages in parallel
  const [offersResult, conversationsResult, unreadResult] = await Promise.allSettled([
    api.get<OfferResponse[]>('/offers', { headers }),
    api.get<ConversationResponse[]>('/messages/conversations', { headers }),
    api.get<UnreadCountResponse>('/messages/unread-count', { headers }),
  ]);

  const notifications: Notification[] = [];
  let offerCount = 0;
  let messageCount = 0;

  // Process offers - only show pending or countered (actionable)
  if (offersResult.status === 'fulfilled') {
    const offers = offersResult.value;
    const actionableOffers = offers.filter(
      o => o.status === 'pending' || o.status === 'countered'
    );
    offerCount = actionableOffers.length;

    // Add recent offers as notifications (limit to 5)
    actionableOffers.slice(0, 5).forEach(offer => {
      notifications.push({
        id: `offer-${offer.id}`,
        type: 'offer',
        offerId: offer.id,
        listingId: offer.listingId,
        listingTitle: offer.listing?.listingTitle || 'Unknown Listing',
        listingImage: offer.listing?.image || null,
        status: offer.status as OfferNotification['status'],
        amount: offer.currentOfferAmount,
        counterAmount: offer.counterOfferAmount,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
        isNew: offer.status === 'countered',
      });
    });
  }

  // Process conversations with unread messages
  if (conversationsResult.status === 'fulfilled') {
    const conversations = conversationsResult.value;
    const unreadConversations = conversations.filter(c => c.unreadCount > 0);

    // Add unread conversations as notifications (limit to 5)
    unreadConversations.slice(0, 5).forEach(conv => {
      notifications.push({
        id: `message-${conv.id}`,
        type: 'message',
        conversationId: conv.id,
        otherUserName: conv.otherUserName,
        listingTitle: conv.listingTitle,
        listingImage: conv.listingImage,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: conv.unreadCount,
      });
    });
  }

  // Get total unread message count
  if (unreadResult.status === 'fulfilled') {
    messageCount = unreadResult.value.unreadCount;
  }

  // Sort notifications by date (most recent first)
  notifications.sort((a, b) => {
    const dateA = a.type === 'offer' ? new Date(a.updatedAt) : new Date(a.lastMessageAt || 0);
    const dateB = b.type === 'offer' ? new Date(b.updatedAt) : new Date(b.lastMessageAt || 0);
    return dateB.getTime() - dateA.getTime();
  });

  return {
    notifications: notifications.slice(0, 10), // Max 10 notifications
    counts: {
      offers: offerCount,
      messages: messageCount,
      total: offerCount + messageCount,
    },
  };
}

/**
 * Format time ago for notifications
 */
export function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format currency for display
 */
export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}
