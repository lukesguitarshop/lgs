// Shared launcher for admin "Login as Customer", used from both the user list
// and the user detail page.

import { impersonateUser } from './api';

/**
 * Opens a new tab signed in as the given customer.
 *
 * The tab is opened synchronously so the browser does not treat it as a popup,
 * then pointed at the handoff page once the token comes back. The token travels
 * in the URL fragment, which is never sent to the server or its logs.
 *
 * @param next Where the impersonated tab should land. Guests have no profile
 *   page to land on, so callers should send them somewhere they can actually use.
 * @throws when the token could not be issued; the opened tab is closed first.
 */
export async function openImpersonationTab(userId: string, next?: string): Promise<void> {
  const tab = window.open('about:blank', '_blank');
  try {
    const res = await impersonateUser(userId);
    const params = new URLSearchParams({
      token: res.token,
      expiresAt: res.expiresAt,
      user: JSON.stringify(res.user),
    });
    if (next) params.set('next', next);

    const url = `/impersonate#${params.toString()}`;
    if (tab) {
      tab.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/**
 * Turns an API rejection into something worth showing next to the button.
 */
export function impersonationErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Failed to start session';
}
