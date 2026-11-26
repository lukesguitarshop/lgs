'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  formatMessageTime,
  getSellerThread,
  refreshPortalBadges,
  sendSellerReply,
  type SellerMessage,
  type SellerThread,
} from '@/lib/seller';

const SENDER: Record<SellerMessage['from'], string> = {
  you: 'You',
  customer: 'Customer',
  shop: "Luke's Guitar Shop",
};

export default function SellerThreadPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { isSeller, isAuthenticated, isLoading: authLoading } = useAuth();

  const [thread, setThread] = useState<SellerThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const shownCount = useRef(0);

  const load = useCallback(async () => {
    try {
      setThread(await getSellerThread(conversationId));
      setError(null);
      // Opening the thread marked it read on the server.
      refreshPortalBadges();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this conversation');
    }
  }, [conversationId]);

  useEffect(() => {
    if (authLoading || !isSeller) return;
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [authLoading, isSeller, load]);

  // Follow the thread down only when something new arrived, not on every poll.
  const messageCount = thread?.messages.length ?? 0;
  useEffect(() => {
    if (messageCount > shownCount.current) {
      endRef.current?.scrollIntoView({ block: 'end' });
    }
    shownCount.current = messageCount;
  }, [messageCount]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const sent = await sendSellerReply(conversationId, text);
      setDraft('');
      setThread((current) => (current ? { ...current, messages: [...current.messages, sent] } : current));
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAuthenticated) return <div className="py-16 text-center">Sign in to open the seller portal.</div>;
  if (!isSeller) return <div className="py-16 text-center">This account doesn&apos;t have seller access.</div>;

  const back = (
    <Link
      href="/seller/messages"
      className="mb-4 inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" />
      All messages
    </Link>
  );

  if (error && !thread) {
    return (
      <div className="max-w-3xl">
        {back}
        <div className="border border-primary/40 bg-primary/5 p-4 text-sm text-primary">{error}</div>
      </div>
    );
  }
  if (!thread) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {back}

      <div className="mb-4 border border-foreground/15 bg-background p-4">
        <h2 className="text-lg font-semibold">{thread.customerName}</h2>
        <p className="mt-1 text-sm text-foreground/70">
          About{' '}
          <Link href={`/listing/${thread.listingId}`} className="text-primary underline">
            {thread.listingTitle}
          </Link>
        </p>
      </div>

      <div className="space-y-3 border border-foreground/15 bg-background p-4" aria-live="polite">
        {thread.messages.map((message) => (
          <Bubble key={message.id} message={message} customerName={thread.customerName} />
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="mt-4">
        <label htmlFor="seller-reply" className="sr-only">
          Reply to {thread.customerName}
        </label>
        <div className="flex items-end gap-3">
          <textarea
            id="seller-reply"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e);
            }}
            rows={3}
            maxLength={5000}
            placeholder={`Reply to ${thread.customerName}`}
            className="min-h-[88px] flex-1 border border-foreground/35 bg-transparent p-3 text-base outline-none placeholder:text-foreground/45 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="font-btn inline-flex h-11 items-center gap-2 bg-primary px-5 text-[13px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </div>
        {sendError && <p className="mt-2 text-sm text-primary">{sendError}</p>}
        <p className="mt-2 text-xs text-foreground/60">
          The customer sees your reply as coming from the shop. Offers and payment are handled by the shop owner.
        </p>
      </form>
    </div>
  );
}

function Bubble({ message, customerName }: { message: SellerMessage; customerName: string }) {
  const sender = message.from === 'customer' ? customerName : SENDER[message.from];
  const time = formatMessageTime(message.createdAt);

  // Offers, acceptances and the like are the shop owner's to act on; here they are a note in the thread.
  if (message.type !== 'text') {
    return (
      <p className="label-mono-sm border-y border-foreground/10 py-2 text-center text-foreground/65">
        {sender} · {message.messageText} · {time}
      </p>
    );
  }

  const mine = message.from === 'you';
  return (
    <div className={`flex ${message.from === 'customer' ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          mine
            ? 'bg-primary text-primary-foreground'
            : message.from === 'shop'
              ? 'border border-foreground/40 bg-background text-foreground'
              : 'border border-foreground/25 bg-muted text-foreground'
        }`}
      >
        <p className={`mb-1 text-xs font-semibold ${mine ? 'text-primary-foreground/80' : 'text-foreground/70'}`}>
          {sender}
        </p>
        {message.imageUrls && message.imageUrls.length > 0 && (
          <div className={`mb-2 grid gap-2 ${message.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {message.imageUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- customer uploads, arbitrary size */}
                <img src={url} alt="Attachment from the conversation" className="max-h-64 rounded" />
              </a>
            ))}
          </div>
        )}
        {message.messageText && <p className="whitespace-pre-wrap break-words text-sm">{message.messageText}</p>}
        <p className={`mt-1 text-xs ${mine ? 'text-primary-foreground/70' : 'text-foreground/60'}`}>{time}</p>
      </div>
    </div>
  );
}
