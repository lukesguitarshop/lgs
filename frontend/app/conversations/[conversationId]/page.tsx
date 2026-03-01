'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Send, DollarSign, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getConversation,
  makeOffer,
  acceptOffer,
  declineOffer,
  sendMessage,
  Conversation,
} from '@/lib/conversations';
import { OfferBubble } from '@/components/conversations/OfferBubble';

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;

  const { isAuthenticated, isLoading: authLoading, setShowLoginModal } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [offerInput, setOfferInput] = useState('');
  const [showOfferInput, setShowOfferInput] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchConversation = async () => {
      try {
        const data = await getConversation(conversationId);
        setConversation(data);
      } catch (error) {
        console.error('Failed to fetch conversation:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversation();
  }, [isAuthenticated, authLoading, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.events]);

  const handleAccept = async () => {
    if (!conversation) return;
    setIsActioning(true);
    try {
      const updated = await acceptOffer(conversation.id);
      setConversation(updated);
    } catch (error) {
      console.error('Failed to accept offer:', error);
    } finally {
      setIsActioning(false);
    }
  };

  const handleDecline = async () => {
    if (!conversation) return;
    const reason = prompt('Reason for declining (optional):');
    setIsActioning(true);
    try {
      const updated = await declineOffer(conversation.id, reason || undefined);
      setConversation(updated);
    } catch (error) {
      console.error('Failed to decline offer:', error);
    } finally {
      setIsActioning(false);
    }
  };

  const handleMakeOffer = async (amount: number) => {
    if (!conversation) return;
    setIsActioning(true);
    try {
      const updated = await makeOffer(conversation.id, amount);
      setConversation(updated);
      setOfferInput('');
      setShowOfferInput(false);
    } catch (error) {
      console.error('Failed to make offer:', error);
    } finally {
      setIsActioning(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation || !messageInput.trim()) return;
    setIsActioning(true);
    try {
      const updated = await sendMessage(conversation.id, messageInput);
      setConversation(updated);
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsActioning(false);
    }
  };

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
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-2xl font-semibold">Sign in to view this conversation</h2>
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

  if (!conversation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-semibold">Conversation not found</h2>
          <Link href="/conversations">
            <Button className="mt-4">Back to Conversations</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const listing = conversation.listing;
  const canMakeOffer = conversation.status === 'active' &&
    (conversation.isMyTurn || conversation.pendingOfferAmount === null);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link
        href="/conversations"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to conversations
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Listing Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardContent className="p-4">
              {listing && (
                <>
                  <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden mb-4">
                    {listing.image ? (
                      <Image
                        src={listing.image}
                        alt={listing.listingTitle}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-6xl">🎸</span>
                      </div>
                    )}
                  </div>
                  <Link href={`/listing/${listing.id}`}>
                    <h3 className="font-semibold text-lg hover:text-[#df5e15] transition-colors">
                      {listing.listingTitle}
                    </h3>
                  </Link>
                  <p className="text-2xl font-bold mt-2">
                    {formatPrice(listing.price, listing.currency)}
                  </p>
                  {listing.condition && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Used - {listing.condition}
                    </p>
                  )}
                </>
              )}

              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {conversation.iAmBuyer ? 'Seller' : 'Buyer'}:
                </p>
                <p className="font-medium">
                  {conversation.iAmBuyer ? conversation.sellerName : conversation.buyerName}
                </p>
              </div>

              {conversation.status === 'accepted' && (
                <div className="mt-4">
                  <Badge className="w-full justify-center py-2 bg-green-600">
                    Accepted: {formatPrice(conversation.acceptedAmount!)}
                  </Badge>
                  {conversation.iAmBuyer && (
                    <Link href="/cart">
                      <Button className="w-full mt-2 bg-[#df5e15] hover:bg-[#c54d0a]">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Go to Cart
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat Thread */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {conversation.events.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                conversation.events.map((event, index) => (
                  <OfferBubble
                    key={index}
                    event={event}
                    isMyTurn={conversation.isMyTurn}
                    pendingExpiresAt={conversation.pendingExpiresAt}
                    conversationStatus={conversation.status}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    onCounter={handleMakeOffer}
                    isLoading={isActioning}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {conversation.status === 'active' && (
              <div className="border-t p-4">
                {showOfferInput ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Enter offer amount"
                      value={offerInput}
                      onChange={(e) => setOfferInput(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => {
                        if (offerInput && !isNaN(parseFloat(offerInput))) {
                          handleMakeOffer(parseFloat(offerInput));
                        }
                      }}
                      disabled={isActioning || !offerInput}
                      className="bg-[#df5e15] hover:bg-[#c54d0a]"
                    >
                      Send Offer
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowOfferInput(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="submit"
                        disabled={isActioning || !messageInput.trim()}
                        variant="outline"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                    {canMakeOffer && (
                      <Button
                        onClick={() => setShowOfferInput(true)}
                        className="bg-[#df5e15] hover:bg-[#c54d0a]"
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Make Offer
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
