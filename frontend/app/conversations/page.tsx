'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation, getConversations } from '@/lib/conversations';
import { ConversationCard } from '@/components/conversations/ConversationCard';

type StatusFilter = 'all' | 'active' | 'accepted' | 'declined' | 'expired';

export default function ConversationsPage() {
  const { isAuthenticated, isLoading: authLoading, setShowLoginModal } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchConversations = async () => {
      try {
        const status = statusFilter === 'all' ? undefined : statusFilter;
        const data = await getConversations(status);
        setConversations(data);
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [isAuthenticated, authLoading, statusFilter]);

  const filteredConversations = statusFilter === 'all'
    ? conversations
    : conversations.filter(c => c.status === statusFilter);

  const myTurnCount = conversations.filter(c => c.isMyTurn && c.status === 'active').length;

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to listings
        </Link>

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <MessageSquare className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Sign in to view your conversations</h2>
            <p className="text-muted-foreground">
              Create an account or sign in to make and manage offers on guitars.
            </p>
            <Button
              onClick={() => setShowLoginModal(true)}
              className="bg-[#df5e15] hover:bg-[#c54d0a] text-white"
            >
              Sign In
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to listings
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Conversations</h1>
        <p className="text-muted-foreground">
          Track and manage your offer negotiations
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'active', 'accepted', 'declined', 'expired'] as StatusFilter[]).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(status)}
            className={statusFilter === status ? 'bg-[#df5e15] hover:bg-[#c54d0a]' : ''}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'all' && ` (${conversations.length})`}
            {status === 'active' && myTurnCount > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5">
                {myTurnCount}
              </span>
            )}
          </Button>
        ))}
      </div>

      {filteredConversations.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <MessageSquare className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">
              {statusFilter === 'all' ? 'No conversations yet' : `No ${statusFilter} conversations`}
            </h2>
            <p className="text-muted-foreground">
              {statusFilter === 'all'
                ? 'Browse listings and make an offer to start negotiating.'
                : `You don't have any conversations with ${statusFilter} status.`}
            </p>
            <Link href="/">
              <Button className="bg-[#df5e15] hover:bg-[#c54d0a] text-white">
                Browse Listings
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredConversations.map(conversation => (
            <ConversationCard key={conversation.id} conversation={conversation} />
          ))}
        </div>
      )}
    </div>
  );
}
