import api from './api';
import { getAuthHeaders } from './auth';

export interface ListingSummary {
  id: string;
  listingTitle: string;
  price: number;
  currency: string;
  condition: string | null;
  image: string | null;
  disabled: boolean;
}

export interface ConversationEvent {
  type: 'message' | 'offer' | 'accept' | 'decline' | 'expire';
  senderId: string | null;
  messageText: string | null;
  offerAmount: number | null;
  createdAt: string;
  isFromMe: boolean;
}

export interface Conversation {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  pendingOfferAmount: number | null;
  pendingExpiresAt: string | null;
  isMyTurn: boolean;
  iAmBuyer: boolean;
  status: 'active' | 'accepted' | 'declined' | 'expired';
  acceptedAmount: number | null;
  createdAt: string;
  updatedAt: string;
  events: ConversationEvent[];
  listing: ListingSummary | null;
}

export async function getConversations(status?: string): Promise<Conversation[]> {
  const endpoint = status ? `/conversations?status=${status}` : '/conversations';
  return api.get<Conversation[]>(endpoint, { headers: getAuthHeaders() });
}

export async function getConversation(id: string): Promise<Conversation> {
  return api.get<Conversation>(`/conversations/${id}`, { headers: getAuthHeaders() });
}

export async function startConversation(
  listingId: string,
  offerAmount?: number,
  message?: string
): Promise<Conversation> {
  return api.post<Conversation>(
    '/conversations',
    { listingId, offerAmount, message },
    { headers: getAuthHeaders() }
  );
}

export async function makeOffer(
  conversationId: string,
  offerAmount: number,
  message?: string
): Promise<Conversation> {
  return api.post<Conversation>(
    `/conversations/${conversationId}/offer`,
    { offerAmount, message },
    { headers: getAuthHeaders() }
  );
}

export async function acceptOffer(conversationId: string): Promise<Conversation> {
  return api.post<Conversation>(
    `/conversations/${conversationId}/accept`,
    {},
    { headers: getAuthHeaders() }
  );
}

export async function declineOffer(
  conversationId: string,
  reason?: string
): Promise<Conversation> {
  return api.post<Conversation>(
    `/conversations/${conversationId}/decline`,
    { reason },
    { headers: getAuthHeaders() }
  );
}

export async function sendMessage(
  conversationId: string,
  message: string
): Promise<Conversation> {
  return api.post<Conversation>(
    `/conversations/${conversationId}/message`,
    { message },
    { headers: getAuthHeaders() }
  );
}

export function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }

  return `${hours}h ${minutes}m remaining`;
}
