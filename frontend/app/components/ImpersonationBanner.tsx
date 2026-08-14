'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, X } from 'lucide-react';

/**
 * Pinned banner shown only in a tab that is impersonating a customer.
 * Impersonated sessions have full access, so this is the reminder that any action
 * taken in this tab happens as the customer.
 */
export default function ImpersonationBanner() {
  const { impersonation, endImpersonation } = useAuth();
  const [now, setNow] = useState(() => Date.now());

  // The token dies on a fixed schedule, so tick often enough that the banner
  // tells the truth without the user having to reload to find out.
  useEffect(() => {
    if (!impersonation) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [impersonation]);

  if (!impersonation) return null;

  const expiresAt = Date.parse(impersonation.expiresAt);
  const expired = Number.isFinite(expiresAt) && now > expiresAt;

  return (
    <div
      className={`sticky top-0 z-50 flex items-center justify-center gap-3 px-4 py-2 text-sm font-semibold ${
        expired ? 'bg-gray-700 text-white' : 'bg-[#6E0114] text-[#FFFFF3]'
      }`}
    >
      <Eye className="h-4 w-4 shrink-0" />
      <span className="truncate">
        {expired ? (
          <>Impersonation session expired &mdash; reopen from the admin page</>
        ) : (
          <>
            Viewing as {impersonation.userName}
            {impersonation.userEmail ? ` (${impersonation.userEmail})` : ''} &mdash; actions here
            happen as this customer
          </>
        )}
      </span>
      <button
        onClick={endImpersonation}
        className="inline-flex items-center gap-1 rounded border border-current px-2 py-0.5 shrink-0 hover:opacity-80 transition-opacity"
      >
        <X className="h-3 w-3" />
        End session
      </button>
    </div>
  );
}
