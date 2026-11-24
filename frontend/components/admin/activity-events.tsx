import {
  Activity, BadgeCheck, CreditCard, Eye, HandCoins, Heart, HeartOff, KeyRound, LogIn,
  MessageSquare, Receipt, Repeat, ShoppingCart, Star, Tag, ThumbsDown, ThumbsUp, Trash2,
  UserCog, UserPlus, UserRoundCheck, Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Every customer event the activity log records, in the order the admin filter lists
 * them. One place for the label and icon, so the global feed and the per-customer feed
 * can't drift apart when an event is added.
 */
const EVENTS: { value: string; label: string; icon: LucideIcon; className: string }[] = [
  { value: 'login', label: 'Logins', icon: LogIn, className: 'text-blue-600' },
  { value: 'registered', label: 'Sign-ups', icon: UserPlus, className: 'text-blue-600' },
  { value: 'email_verified', label: 'Email verified', icon: BadgeCheck, className: 'text-blue-600' },
  { value: 'password_reset_requested', label: 'Password reset requests', icon: KeyRound, className: 'text-gray-500' },
  { value: 'password_changed', label: 'Password changes', icon: KeyRound, className: 'text-gray-500' },
  { value: 'profile_updated', label: 'Profile updates', icon: UserCog, className: 'text-gray-500' },
  { value: 'listing_view', label: 'Listing views', icon: Eye, className: 'text-gray-500' },
  { value: 'favorite', label: 'Favorites', icon: Heart, className: 'text-pink-600' },
  { value: 'unfavorite', label: 'Unfavorites', icon: HeartOff, className: 'text-gray-400' },
  { value: 'add_to_cart', label: 'Add to cart', icon: ShoppingCart, className: 'text-[#6E0114]' },
  { value: 'remove_from_cart', label: 'Removed from cart', icon: Trash2, className: 'text-gray-400' },
  { value: 'checkout_started', label: 'Checkout started', icon: CreditCard, className: 'text-[#6E0114]' },
  { value: 'discount_applied', label: 'Discount codes', icon: Tag, className: 'text-[#6E0114]' },
  { value: 'order_placed', label: 'Orders placed', icon: Receipt, className: 'text-green-600' },
  { value: 'deposit_paid', label: 'Deposits paid', icon: Wallet, className: 'text-green-600' },
  { value: 'message_sent', label: 'Messages sent', icon: MessageSquare, className: 'text-blue-600' },
  { value: 'offer_made', label: 'Offers made', icon: HandCoins, className: 'text-amber-600' },
  { value: 'offer_countered', label: 'Offers countered', icon: Repeat, className: 'text-amber-600' },
  { value: 'offer_accepted', label: 'Offers accepted', icon: ThumbsUp, className: 'text-green-600' },
  { value: 'offer_declined', label: 'Offers declined', icon: ThumbsDown, className: 'text-gray-500' },
  { value: 'trade_in_submitted', label: 'Trade-ins submitted', icon: Repeat, className: 'text-[#6E0114]' },
  { value: 'review_left', label: 'Reviews', icon: Star, className: 'text-amber-500' },
  { value: 'admin_impersonation', label: 'Admin sign-ins as customer', icon: UserRoundCheck, className: 'text-[#6E0114]' },
];

const BY_TYPE = new Map(EVENTS.map((event) => [event.value, event]));

/** Options for the admin feed's type filter. */
export const ACTIVITY_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'All events' },
  ...EVENTS.map(({ value, label }) => ({ value, label })),
];

export function ActivityIcon({ type }: { type: string }) {
  const event = BY_TYPE.get(type);
  const Icon = event?.icon ?? Activity;
  return <Icon className={`h-4 w-4 ${event?.className ?? 'text-gray-400'}`} />;
}
