export type TradeInCondition = 'Mint' | 'Excellent' | 'Very Good' | 'Good' | 'Fair';

export type TradeInStatus =
  | 'submitted' | 'offered' | 'accepted' | 'declined' | 'expired'
  | 'received' | 'inspected' | 'completed' | 'cancelled' | 'rejected';

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

export interface TradeInAddress {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface TradeInShipping {
  returnAddress?: TradeInAddress | null;
  canEditReturnAddress?: boolean;
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
  canCancel: boolean;
  photos: TradeInPhoto[];
  activeOffer?: TradeInOffer | null;
  shipping?: TradeInShipping | null;
  payout?: TradeInPayout | null;
  createdAt: string;
}

export interface AdminTradeInListItem {
  id: string;
  email: string;
  userId: string;
  fullName?: string | null;
  brand: string;
  model: string;
  condition: string;
  status: TradeInStatus;
  photoCount: number;
  thumbnailUrl?: string | null;
  createdAt: string;
}

export interface AdminTradeInDetail extends TradeInRequestDto {
  email: string;
  userId: string;
  fullName?: string | null;
  canOffer: boolean;
  allOffers: TradeInOffer[];
  paypalEmail?: string | null;
  paypalTransactionId?: string | null;
  inspectionNotes?: string | null;
}
