export type TradeInCondition = 'Excellent' | 'Very Good' | 'Good' | 'Fair';

export type TradeInStatus =
  | 'submitted' | 'offered' | 'accepted' | 'declined' | 'expired'
  | 'received' | 'inspected' | 'completed' | 'cancelled';

export interface TradeInPhoto { url: string; }

export interface TradeInOffer {
  cashOffer: number;
  storeCreditOffer: number;
  expiresAt: string;
  acceptedType?: 'cash' | 'credit' | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  isExpired: boolean;
}

export interface TradeInShipping {
  labelUrl?: string | null;
  receivedAt?: string | null;
  inspectedAt?: string | null;
}

export interface TradeInPayout {
  completedAt?: string | null;
  paidAt?: string | null;
}

export interface TradeInRequestDto {
  id: string;
  brand: string;
  model: string;
  condition: TradeInCondition;
  notes: string;
  status: TradeInStatus;
  photos: TradeInPhoto[];
  activeOffer?: TradeInOffer | null;
  shipping?: TradeInShipping | null;
  payout?: TradeInPayout | null;
  createdAt: string;
}

export interface AdminTradeInListItem {
  id: string;
  email: string;
  brand: string;
  model: string;
  condition: string;
  status: TradeInStatus;
  createdAt: string;
}

export interface AdminTradeInDetail extends TradeInRequestDto {
  email: string;
  userId: string;
  allOffers: TradeInOffer[];
  paypalEmail?: string | null;
  paypalTransactionId?: string | null;
  inspectionNotes?: string | null;
}
