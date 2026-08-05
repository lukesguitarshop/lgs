'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { startImpersonation, type User } from '@/lib/auth';

/**
 * Handoff page for admin "Login as Customer".
 *
 * The admin page opens this in a new tab with the impersonation token in the URL
 * fragment - fragments are never sent to the server, so the token stays out of
 * request logs. We stash it in this tab's sessionStorage, strip the fragment from
 * history, then do a full page load of the destination so the whole app boots with
 * the customer's session instead of the admin's.
 */
export default function ImpersonatePage() {
  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const userJson = params.get('user');
    const next = params.get('next') || '/account';

    let user: User | null = null;
    if (userJson) {
      try {
        user = JSON.parse(userJson);
      } catch {
        user = null;
      }
    }

    // Nothing usable to hand off (stale bookmark, hand-edited URL) - go back to admin
    if (!token || !user) {
      window.location.replace('/admin');
      return;
    }

    startImpersonation(token, user, params.get('expiresAt') || '');

    // Drop the token from this tab's history before navigating on
    window.history.replaceState(null, '', '/impersonate');

    // Full page load so AuthProvider initialises from the impersonated session
    window.location.replace(next);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-600">
      <Loader2 className="h-8 w-8 animate-spin mb-4" />
      <p>Signing in as customer...</p>
    </div>
  );
}
