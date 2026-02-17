'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, MessageSquare, Circle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';

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

export default function MessagesPage() {
  const { isAuthenticated, isLoading: authLoading, setShowLoginModal } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
            <h2 className="text-2xl font-semibold">Sign in to view your messages</h2>
            <p className="text-muted-foreground">
              Create an account or sign in to message sellers about guitars.
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

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

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
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Messages</h1>
          {totalUnread > 0 && (
            <Badge className="bg-[#df5e15] text-white">
              {totalUnread} unread
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-2">
          Your conversations with sellers
        </p>
      </div>

      {conversations.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <MessageSquare className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">No messages yet</h2>
            <p className="text-muted-foreground">
              When you message a seller about a guitar, your conversations will appear here.
            </p>
            <Link href="/">
              <Button className="bg-[#df5e15] hover:bg-[#c54d0a] text-white">
                Browse Listings
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {conversations.map(conversation => (
            <ConversationCard key={conversation.id} conversation={conversation} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ConversationCardProps {
  conversation: Conversation;
}

function ConversationCard({ conversation }: ConversationCardProps) {
  return (
    <Link href={`/messages/${conversation.id}`}>
      <Card className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${conversation.unreadCount > 0 ? 'bg-orange-50 border-orange-200' : ''}`}>
        <div className="flex items-center gap-4">
          {/* Listing Image or Avatar */}
          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {conversation.listingImage ? (
              <Image
                src={conversation.listingImage}
                alt={conversation.listingTitle || 'Listing'}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">
                🎸
              </div>
            )}
          </div>

          {/* Conversation Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                {conversation.unreadCount > 0 && (
                  <Circle className="h-2 w-2 fill-[#df5e15] text-[#df5e15] flex-shrink-0" />
                )}
                <span className={`font-semibold truncate ${conversation.unreadCount > 0 ? 'text-foreground' : 'text-foreground'}`}>
                  {conversation.otherUserName}
                </span>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatTimeAgo(conversation.lastMessageAt)}
              </span>
            </div>

            {conversation.listingTitle && (
              <p className="text-sm text-muted-foreground truncate mb-1">
                Re: {conversation.listingTitle}
              </p>
            )}

            <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
              {conversation.lastMessage || 'No messages yet'}
            </p>
          </div>

          {/* Unread Badge */}
          {conversation.unreadCount > 0 && (
            <Badge className="bg-[#df5e15] text-white flex-shrink-0">
              {conversation.unreadCount}
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}
