'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/state-block';
import { ArrowLeft, Loader2, MessageSquare, Circle, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  otherUserId: string | null;
  otherUserName: string;
  listingId: string | null;
  listingTitle: string | null;
  listingImage: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  unreadCount: number;
  // Offer fields
  activeOfferAmount?: number;
  activeOfferBy?: string;
  pendingActionBy?: 'buyer' | 'seller';
  offerExpiresAt?: string;
  offerStatus?: 'active' | 'accepted' | 'declined' | 'expired';
  acceptedAmount?: number;
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// MainShell already supplies the 20px phone gutter; the page only pads from md up.
const pageClass = 'container mx-auto md:px-4 md:py-8';
// A 48px mono row on phones (.mobile-label is inert from md), today's inline link on desktop.
const backLinkClass =
  'mobile-label inline-flex min-h-12 items-center text-foreground hover:text-primary mb-6 transition-colors cursor-pointer md:min-h-0';

function MessagesPageContent() {
  const { isAuthenticated, isLoading: authLoading, setShowLoginModal } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'offers'>('all');
  const searchParams = useSearchParams();

  // Read filter from URL params
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    setFilter(filterParam === 'offers' ? 'offers' : 'all');
  }, [searchParams]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchConversations = async () => {
      try {
        const data = await api.get<Conversation[]>('/messages/conversations', {
          headers: getAuthHeaders(),
        });
        setConversations(data);
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();

    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, authLoading]);

  // Filter conversations based on filter state
  const filteredConversations = filter === 'offers'
    ? conversations.filter(c => c.offerStatus != null)
    : conversations;

  if (authLoading || isLoading) {
    return (
      <div className={pageClass}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={pageClass}>
        <Link href="/" className={backLinkClass}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to listings
        </Link>

        {/* Phone: the page keeps its h1 and the sign-in prompt is a warning block. */}
        <div className="md:hidden">
          <h1 className="mobile-h1">Messages</h1>
          <StateBlock variant="warning" className="mt-5">
            <p className="font-semibold">Sign in to view your messages</p>
            <p className="mt-1">Create an account or sign in to message sellers about guitars.</p>
          </StateBlock>
          <Button onClick={() => setShowLoginModal(true)} className="mt-4 w-full">
            Sign In
          </Button>
        </div>

        <Card className="hidden md:block p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <MessageSquare className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Sign in to view your messages</h2>
            <p className="text-muted-foreground">
              Create an account or sign in to message sellers about guitars.
            </p>
            <Button
              onClick={() => setShowLoginModal(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Sign In
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  return (
    <div className={pageClass}>
      <Link href="/" className={backLinkClass}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to listings
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="mobile-h1 text-3xl font-bold">Messages</h1>
          {totalUnread > 0 && (
            <span className="label-mono-sm bg-primary text-primary-foreground px-2 py-1">
              {totalUnread} unread
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-2">
          Your conversations with sellers
        </p>

        {/* Filter tabs: a 2-up row of 48px toggles on phones, today's inline pair from md. */}
        <div className="grid grid-cols-2 gap-2 mt-4 md:flex">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            aria-pressed={filter === 'all'}
            className="h-12 md:h-8"
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            All Messages
          </Button>
          <Button
            variant={filter === 'offers' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('offers')}
            aria-pressed={filter === 'offers'}
            className="h-12 md:h-8"
          >
            <Tag className="h-4 w-4 mr-1" />
            With Offers
          </Button>
        </div>
      </div>

      {filteredConversations.length === 0 ? (
        <>
          {/* Phone: a bordered block that simply ends the list, in place of the centred card. */}
          <div className="md:hidden border border-foreground/20 p-5">
            <p className="text-[17px] font-semibold leading-[1.3] text-foreground">
              {filter === 'offers' ? 'No offers' : 'No messages yet'}
            </p>
            <p className="mt-2 text-base leading-[1.5] text-foreground/78">
              {filter === 'offers'
                ? 'Offers will appear here.'
                : 'When you message a seller about a guitar, your conversations will appear here.'}
            </p>
            {filter === 'offers' ? (
              <Button variant="outline" onClick={() => setFilter('all')} className="mt-4 w-full">
                View All Messages
              </Button>
            ) : (
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href="/">Browse Listings</Link>
              </Button>
            )}
          </div>

          <Card className="hidden md:block p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              {filter === 'offers' ? (
                <>
                  <Tag className="h-16 w-16 text-muted-foreground" />
                  <h2 className="text-2xl font-semibold">No offers</h2>
                  <p className="text-muted-foreground">
                    Offers will appear here.
                  </p>
                  <Button
                    onClick={() => setFilter('all')}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    View All Messages
                  </Button>
                </>
              ) : (
                <>
                  <MessageSquare className="h-16 w-16 text-muted-foreground" />
                  <h2 className="text-2xl font-semibold">No messages yet</h2>
                  <p className="text-muted-foreground">
                    When you message a seller about a guitar, your conversations will appear here.
                  </p>
                  <Link href="/">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      Browse Listings
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </Card>
        </>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map(conversation => (
            <ConversationCard key={conversation.id} conversation={conversation} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className={pageClass}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <MessagesPageContent />
    </Suspense>
  );
}

interface ConversationCardProps {
  conversation: Conversation;
}

function ConversationCard({ conversation }: ConversationCardProps) {
  const unread = conversation.unreadCount > 0;

  return (
    <Link href={`/messages/${conversation.id}`}>
      <Card
        className={cn(
          'p-4 transition-colors cursor-pointer hover:border-primary',
          unread && 'border-[1.5px] border-primary'
        )}
      >
        <div className="flex items-center gap-4">
          {/* Listing photo: 4:5 on phones, the 64px square it always was from md. A
              conversation with no listing photo shows the hatch. */}
          <div className="photo-panel relative w-16 aspect-[4/5] overflow-hidden flex-shrink-0 md:aspect-auto md:h-16">
            {conversation.listingImage && (
              <Image
                src={conversation.listingImage}
                alt={conversation.listingTitle || 'Listing'}
                fill
                sizes="64px"
                className="object-cover"
              />
            )}
          </div>

          {/* Conversation Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                {unread && (
                  <Circle className="hidden md:block h-2 w-2 fill-primary text-primary flex-shrink-0" />
                )}
                <span className="font-semibold truncate text-foreground">
                  {conversation.otherUserName}
                </span>
              </div>
              <span className="text-[13px] text-foreground/70 flex-shrink-0 md:text-xs">
                {formatTimeAgo(conversation.lastMessageAt)}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-1">
              {conversation.listingTitle && (
                <p className="text-sm text-foreground/70 truncate">
                  Re: {conversation.listingTitle}
                </p>
              )}
              {conversation.offerStatus === 'active' && (
                <span className="label-mono-sm bg-muted-foreground text-foreground px-2 py-1 flex-shrink-0">
                  ${conversation.activeOfferAmount?.toLocaleString()} offer
                </span>
              )}
              {conversation.offerStatus === 'accepted' && (
                <span className="label-mono-sm bg-foreground text-background px-2 py-1 flex-shrink-0">
                  Accepted
                </span>
              )}
            </div>

            <p className={`text-sm truncate ${unread ? 'font-medium text-foreground' : 'text-foreground/70'}`}>
              {conversation.lastMessage || 'No messages yet'}
            </p>

            {unread && (
              <p className="label-mono-sm mt-1.5 text-primary md:hidden">Unread</p>
            )}
          </div>

          {/* Unread count */}
          {unread && (
            <span className="label-mono-sm bg-primary text-primary-foreground px-2 py-1 flex-shrink-0">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
