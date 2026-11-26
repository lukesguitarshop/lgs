'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Guitar, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatMessageTime, getSellerConversations, type SellerConversation } from '@/lib/seller';

export default function SellerMessagesPage() {
  const { isSeller, isAuthenticated, isLoading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<SellerConversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isSeller) return;
    let cancelled = false;
    const load = () =>
      getSellerConversations()
        .then((data) => {
          if (cancelled) return;
          setConversations(data);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load messages');
        });
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authLoading, isSeller]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAuthenticated) return <div className="py-16 text-center">Sign in to open the seller portal.</div>;
  if (!isSeller) return <div className="py-16 text-center">This account doesn&apos;t have seller access.</div>;

  return (
    <div className="max-w-3xl">
      <p className="mb-6 text-foreground/70">
        Customers asking about your guitars. You can reply here; the shop owner sees every conversation too.
      </p>

      {error && <div className="mb-6 border border-primary/40 bg-primary/5 p-4 text-sm text-primary">{error}</div>}

      {conversations === null && !error ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : conversations && conversations.length === 0 ? (
        <p className="border border-foreground/15 bg-background p-6 text-foreground/70">
          No messages yet. When a customer asks about one of your guitars, the conversation shows up here.
        </p>
      ) : (
        <ul className="space-y-3">
          {conversations?.map((c) => (
            <li key={c.id}>
              <Link
                href={`/seller/messages/${c.id}`}
                className="flex items-center gap-4 border border-foreground/15 bg-background p-4 transition-colors hover:border-primary"
              >
                <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden bg-muted">
                  {c.listingImage ? (
                    <Image src={c.listingImage} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    <Guitar className="h-6 w-6 text-muted-foreground/60" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`truncate text-foreground ${c.unreadCount > 0 ? 'font-bold' : 'font-semibold'}`}>
                      {c.customerName}
                    </span>
                    {c.lastMessageAt && (
                      <span className="label-mono-sm flex-shrink-0 text-foreground/55">
                        {formatMessageTime(c.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <p className="label-mono-sm mt-0.5 truncate text-foreground/60">{c.listingTitle}</p>
                  <p className={`mt-1 truncate text-sm ${c.unreadCount > 0 ? 'text-foreground' : 'text-foreground/70'}`}>
                    {c.lastMessage}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span
                    aria-label={`${c.unreadCount} unread`}
                    className="flex h-6 min-w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[11px] font-semibold text-primary-foreground"
                  >
                    {c.unreadCount}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
