// Records user activity events to the backend for the admin activity feed.
// Fire-and-forget: never blocks or throws into the UI.

import { api } from './api';
import { getToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

type ClientActivityType = 'add_to_cart' | 'remove_from_cart' | 'checkout_started';

function logActivity(type: ClientActivityType, listingId: string | undefined, listingTitle: string): void {
  // Only logged-in users have a token; guests are skipped.
  if (!getToken()) return;

  api.authPost('/activity', { type, listingId, listingTitle }).catch(() => {
    // Activity logging is best-effort; ignore failures.
  });
}

/**
 * Log that the current (logged-in) user added a listing to their cart.
 * No-op for anonymous/guest visitors (no token).
 */
export function logAddToCart(listingId: string, listingTitle: string): void {
  logActivity('add_to_cart', listingId, listingTitle);
}

/** Log that the current (logged-in) user took a listing back out of their cart. */
export function logRemoveFromCart(listingId: string, listingTitle: string): void {
  logActivity('remove_from_cart', listingId, listingTitle);
}

/**
 * Log that the current (logged-in) user reached checkout with these items.
 * The server keeps one entry a day per cart, so reloads don't repeat it.
 */
export function logCheckoutStarted(items: { id: string; title: string }[]): void {
  if (items.length === 0) return;
  const title = items.length === 1 ? items[0].title : `${items[0].title} and ${items.length - 1} more`;
  logActivity('checkout_started', items.length === 1 ? items[0].id : undefined, title);
}

/**
 * Tell the server a listing page was opened in a real browser. Sent for everyone,
 * signed in or not: the server counts one view per visitor per day, leaves out bots
 * and admins, and adds a line to a signed-in customer's activity feed.
 */
export function recordListingView(listingId: string): void {
  const token = getToken();
  fetch(`${API_BASE_URL}/listings/${listingId}/view`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    keepalive: true,
  }).catch(() => {
    // View counting is best-effort; ignore failures.
  });
}
