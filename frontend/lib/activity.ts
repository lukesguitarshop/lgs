// Records user activity events to the backend for the admin activity feed.
// Fire-and-forget: never blocks or throws into the UI.

import { api } from './api';
import { getToken } from './auth';

/**
 * Log that the current (logged-in) user added a listing to their cart.
 * No-op for anonymous/guest visitors (no token).
 */
export function logAddToCart(listingId: string, listingTitle: string): void {
  // Only logged-in users have a token; guests are skipped.
  if (!getToken()) return;

  api
    .authPost('/activity', {
      type: 'add_to_cart',
      listingId,
      listingTitle,
    })
    .catch(() => {
      // Activity logging is best-effort; ignore failures.
    });
}
