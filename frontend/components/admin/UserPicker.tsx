'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, Check, X, Search } from 'lucide-react';
import { getAdminUsers } from '@/lib/api';
import type { AdminUser } from '@/lib/types/admin-user';

interface UserPickerProps {
  /** Currently selected user id, if any. */
  value: string | null;
  onChange: (userId: string | null, user: AdminUser | null) => void;
  /** Pre-selected user, so editing an existing reservation shows the holder immediately. */
  initialUser?: { id: string; name: string | null; email: string | null } | null;
  disabled?: boolean;
}

/**
 * Searchable customer picker. Searches by name OR email and shows both in the
 * results, so the admin can tell apart two customers with the same name.
 */
export function UserPicker({ value, onChange, initialUser, disabled }: UserPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ id: string; name: string; email: string } | null>(
    initialUser
      ? {
          id: initialUser.id,
          name: initialUser.name || 'Unknown',
          email: initialUser.email || '',
        }
      : null
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the visible selection in sync when the parent clears or replaces it.
  useEffect(() => {
    if (!value) {
      setSelected(null);
    } else if (initialUser && initialUser.id === value) {
      setSelected({
        id: initialUser.id,
        name: initialUser.name || 'Unknown',
        email: initialUser.email || '',
      });
    }
  }, [value, initialUser]);

  // Debounced search so we aren't firing a request per keystroke.
  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Guests are excluded: a reservation must be for a real registered account.
        const page = await getAdminUsers(trimmed, undefined, false, undefined, 1, 10);
        if (!cancelled) setResults(page.items || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const pick = (user: AdminUser) => {
    setSelected({ id: user.id, name: user.fullName, email: user.email || '' });
    onChange(user.id, user);
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    setSelected(null);
    onChange(null, null);
    setQuery('');
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-gray-900">{selected.name}</div>
          {selected.email && (
            <div className="truncate text-xs text-gray-500">{selected.email}</div>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={clear}
            className="ml-2 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Clear selected customer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name or email…"
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {results.length === 0 && !loading && (
            <div className="px-3 py-3 text-sm text-gray-500">
              No registered accounts match that.
            </div>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => pick(user)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-900">{user.fullName}</div>
                <div className="truncate text-xs text-gray-500">{user.email || 'No email'}</div>
              </div>
              {value === user.id && <Check className="h-4 w-4 shrink-0 text-green-600" />}
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length > 0 && query.trim().length < 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-lg">
          Keep typing to search…
        </div>
      )}
    </div>
  );
}
