import api from './api';

/** A customer conversation about one of the signed-in seller's guitars. */
export interface SellerConversation {
  id: string;
  customerName: string;
  listingId: string;
  listingTitle: string;
  listingImage: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface SellerMessage {
  id: string;
  /** Who wrote it, from the seller's point of view. "shop" is the shop owner. */
  from: 'you' | 'customer' | 'shop';
  messageText: string;
  imageUrls?: string[] | null;
  createdAt: string;
  type: 'text' | 'offer' | 'accept' | 'decline' | 'expire' | 'counter';
  offerAmount?: number | null;
}

export interface SellerThread {
  id: string;
  customerName: string;
  listingId: string;
  listingTitle: string;
  listingImage: string | null;
  messages: SellerMessage[];
}

export const getSellerConversations = () => api.authGet<SellerConversation[]>('/seller/conversations');

export const getSellerThread = (id: string) => api.authGet<SellerThread>(`/seller/conversations/${id}`);

export const sendSellerReply = (id: string, messageText: string) =>
  api.authPost<SellerMessage>(`/seller/conversations/${id}/messages`, { messageText });

/** Ask the portal sidebar to recount unread messages (see AdminShell's useBadges). */
export function refreshPortalBadges() {
  window.dispatchEvent(new Event('portal-badges-stale'));
}

/** "3:42 PM" today, "Tue 3:42 PM" this week, otherwise "Nov 4". */
export function formatMessageTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (date.toDateString() === now.toDateString()) return time;
  if (days < 6) return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
