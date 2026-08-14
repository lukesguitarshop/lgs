export type ReservationType = 'hold' | 'trade_in' | 'offer_accepted';

export type ReservationStatus =
  | 'pending'
  | 'deposit_paid'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type CancellationReason =
  | 'customer_backed_out'
  | 'trade_fell_through'
  | 'expired'
  | 'sold_elsewhere'
  | 'other';

/** Admin-selectable types. `offer_accepted` is created by the offer flow, not by hand. */
export const RESERVATION_TYPE_OPTIONS: { value: ReservationType; label: string }[] = [
  { value: 'hold', label: 'Hold' },
  { value: 'trade_in', label: 'Trade-In' },
];

export const RESERVATION_STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'deposit_paid', label: 'Deposit Paid' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
];

export const CANCELLATION_REASON_OPTIONS: { value: CancellationReason; label: string }[] = [
  { value: 'customer_backed_out', label: 'Customer backed out' },
  { value: 'trade_fell_through', label: 'Trade fell through' },
  { value: 'expired', label: 'Expired' },
  { value: 'sold_elsewhere', label: 'Sold elsewhere' },
  { value: 'other', label: 'Other' },
];

/** Default hold length per type, mirroring the server. */
export function defaultExpiryDays(type: ReservationType): number {
  if (type === 'trade_in') return 30;
  if (type === 'offer_accepted') return 3;
  return 7;
}

/** Admin view. Includes the holder's identity — never render this on a public page. */
export interface AdminReservation {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_image: string | null;
  listing_price: number | null;
  listing_sold: boolean;

  type: ReservationType;
  type_label: string;
  status: ReservationStatus;
  status_label: string;

  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  is_unassigned: boolean;
  user_missing: boolean;

  agreed_price: number;
  trade_in_credit: number;
  deposit_required: boolean;
  deposit_amount: number;
  deposit_refundable: boolean;
  deposit_paid_amount: number;
  deposit_paid_at: string | null;
  deposit_payment_method: string | null;
  deposit_order_id: string | null;
  final_order_id: string | null;
  balance_due: number;
  is_over_credited: boolean;

  expires_at: string | null;
  is_expired: boolean;
  internal_note: string | null;
  cancellation_reason: string | null;
  needs_review: boolean;
  needs_review_reason: string | null;
  source_conversation_id: string | null;

  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ReservationSummary {
  active_holds: number;
  deposits_held: number;
  expiring_48h: number;
  needs_review: number;
  unassigned: number;
}

/** Customer-facing view. Contains no identity information and no admin note. */
export interface MyReservation {
  id: string;
  type: ReservationType;
  type_label: string;
  status: ReservationStatus;
  status_label: string;
  agreed_price: number;
  trade_in_credit: number;
  deposit_required: boolean;
  deposit_amount: number;
  deposit_refundable: boolean;
  deposit_paid_amount: number;
  deposit_paid_at: string | null;
  balance_due: number;
  expires_at: string | null;
  currency: string;
}

/**
 * What /api/reservations/listing/{id} returns. Non-holders get only `is_reserved`,
 * `badge` and `message` — never who the holder is.
 */
export interface ListingReservationState {
  is_reserved: boolean;
  is_mine?: boolean;
  type?: ReservationType;
  badge?: string;
  message?: string;
  reservation?: MyReservation;
}

export interface DepositDetails {
  reservation_id: string;
  listing_id: string;
  listing_title: string;
  listing_image: string | null;
  currency: string;
  line_item_label: string;
  agreed_price: number;
  trade_in_credit: number;
  deposit_amount: number;
  deposit_refundable: boolean;
  balance_after_deposit: number;
  expires_at: string | null;
  shipping_charged: boolean;
  tax_charged: boolean;
}

export interface CreateReservationPayload {
  listingId: string;
  userId: string;
  type: ReservationType;
  agreedPrice: number;
  tradeInCredit: number;
  depositRequired: boolean;
  depositAmount: number;
  depositRefundable: boolean;
  expiresAt: string | null;
  noExpiration: boolean;
  internalNote: string | null;
}

export interface UpdateReservationPayload {
  userId?: string;
  agreedPrice?: number;
  tradeInCredit?: number;
  depositRequired?: boolean;
  depositAmount?: number;
  depositRefundable?: boolean;
  expiresAt?: string | null;
  noExpiration?: boolean;
  internalNote?: string | null;
}

// ---------- display helpers ----------

export function statusBadgeClasses(status: ReservationStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'deposit_paid':
      return 'bg-green-100 text-green-800';
    case 'expired':
      return 'bg-gray-200 text-gray-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function typeBadgeClasses(type: ReservationType): string {
  switch (type) {
    case 'trade_in':
      return 'bg-purple-100 text-purple-800';
    case 'offer_accepted':
      return 'bg-sky-100 text-sky-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

/** Hours until expiry; null when there is no expiration. */
export function hoursUntil(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return (new Date(expiresAt).getTime() - Date.now()) / 36e5;
}

/** True when a hold lapses in under 48 hours — drives the red highlight. */
export function isExpiringSoon(expiresAt: string | null): boolean {
  const hours = hoursUntil(expiresAt);
  return hours !== null && hours > 0 && hours < 48;
}

/** "in 6 days" / "in 5 hours" / "expired". */
export function relativeExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiration';

  const hours = hoursUntil(expiresAt)!;
  if (hours <= 0) return 'Expired';
  if (hours < 1) return `in ${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `in ${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'}`;

  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
