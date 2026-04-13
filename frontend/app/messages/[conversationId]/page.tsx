'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, MessageSquare, Send, User, Tag, Paperclip, X, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import { linkifyText } from '@/lib/utils';
import { MakeOfferModal } from '@/components/offers/MakeOfferModal';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  listingId: string | null;
  messageText: string;
  imageUrls?: string[];
  createdAt: string;
  isRead: boolean;
  isMine: boolean;
  type: 'text' | 'offer' | 'accept' | 'decline' | 'expire' | 'counter';
  offerAmount?: number;
}

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

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function shouldShowDateSeparator(currentMsg: Message, prevMsg: Message | null): boolean {
  if (!prevMsg) return true;
  const currentDate = new Date(currentMsg.createdAt).toDateString();
  const prevDate = new Date(prevMsg.createdAt).toDateString();
  return currentDate !== prevDate;
}

function ConversationPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = params.conversationId as string;
  const fromAdmin = searchParams.get('from') === 'admin';
  const fromListing = searchParams.get('from') === 'listing';
  const listingIdParam = searchParams.get('listingId');
  const { isAuthenticated, isLoading: authLoading, setShowLoginModal } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [listingPrice, setListingPrice] = useState<{ price: number; currency: string } | null>(null);
  const [isActioning, setIsActioning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const MAX_MESSAGE_LENGTH = 500;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightboxUrl) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [lightboxUrl]);

  // Fetch conversation details
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const fetchConversation = async () => {
      try {
        const conversations = await api.authGet<Conversation[]>('/messages/conversations');
        const conv = conversations.find(c => c.id === conversationId);
        setConversation(conv || null);
      } catch (error) {
        console.error('Failed to fetch conversation:', error);
      }
    };

    fetchConversation();
  }, [conversationId, authLoading, isAuthenticated]);

  // Fetch listing price when there's a listing context
  useEffect(() => {
    if (!conversation?.listingId) {
      setListingPrice(null);
      return;
    }

    const fetchListingPrice = async () => {
      try {
        const listing = await api.get<{ price: number; currency: string; disabled?: boolean }>(`/listings/${conversation.listingId}`);
        // Set price if listing exists (even if disabled - needed for counter offers)
        if (listing && listing.price) {
          setListingPrice({ price: listing.price, currency: listing.currency });
        } else {
          setListingPrice(null);
        }
      } catch {
        // Silently handle - listing may be deleted
        setListingPrice(null);
      }
    };

    fetchListingPrice();
  }, [conversation?.listingId]);

  // Fetch messages
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchMessages = async () => {
      try {
        const data = await api.authGet<Message[]>(`/messages/conversation/${conversationId}`);
        setMessages(data);
        setError(null);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        setError('Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [conversationId, isAuthenticated, authLoading]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((!newMessage.trim() && selectedImages.length === 0) || isSending || !conversation?.otherUserId) return;

    setIsSending(true);
    setError(null);

    try {
      let sentMessage: Message;

      if (selectedImages.length > 0) {
        // Use FormData for image uploads
        const formData = new FormData();
        formData.append('recipientId', conversation.otherUserId);
        formData.append('messageText', newMessage.trim());
        if (conversation.listingId) {
          formData.append('listingId', conversation.listingId);
        }
        selectedImages.forEach((image) => {
          formData.append('images', image);
        });

        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
        const response = await fetch(`${apiBaseUrl}/messages/with-images`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to send message');
        }

        sentMessage = await response.json();
      } else {
        sentMessage = await api.authPost<Message>('/messages', {
          recipientId: conversation.otherUserId,
          messageText: newMessage.trim(),
          listingId: conversation.listingId,
        });
      }

      setMessages(prev => [...prev, sentMessage]);
      setNewMessage('');
      setSelectedImages([]);
      setImagePreviews([]);
      textareaRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 4 images total
    const remainingSlots = 4 - selectedImages.length;
    const newFiles = files.slice(0, remainingSlots);

    setSelectedImages(prev => [...prev, ...newFiles]);

    // Create previews
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setNewMessage(value);
    }
  };

  const refreshConversation = async () => {
    const convs = await api.authGet<Conversation[]>('/messages/conversations');
    const updated = convs.find(c => c.id === conversationId);
    if (updated) setConversation(updated);
  };

  const refreshMessages = async () => {
    const updatedMessages = await api.authGet<Message[]>(`/messages/conversation/${conversationId}`);
    setMessages(updatedMessages);
  };

  const handleAcceptOffer = async () => {
    if (!conversationId || isActioning) return;

    setIsActioning(true);
    setError(null);
    try {
      await api.authPost(`/messages/conversations/${conversationId}/accept`, {});
      await refreshMessages();
      await refreshConversation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept offer');
    } finally {
      setIsActioning(false);
    }
  };

  const handleDeclineOffer = async () => {
    if (!conversationId || isActioning) return;

    setIsActioning(true);
    setError(null);
    try {
      await api.authPost(`/messages/conversations/${conversationId}/decline`, {});
      await refreshMessages();
      await refreshConversation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline offer');
    } finally {
      setIsActioning(false);
    }
  };

  const handleMakeOffer = async (amount: number) => {
    if (!conversationId || isActioning) return;

    setIsActioning(true);
    setError(null);
    try {
      // Use counter endpoint if there's an active offer, otherwise use regular offer endpoint
      const endpoint = conversation?.offerStatus === 'active'
        ? `/messages/conversations/${conversationId}/counter`
        : `/messages/conversations/${conversationId}/offer`;

      await api.authPost(endpoint, {
        offerAmount: amount,
      });
      await refreshMessages();
      await refreshConversation();
      setShowOfferModal(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorMessage.toLowerCase().includes('active offer')) {
        setError('There is already an active offer in this conversation.');
      } else {
        setError(errorMessage || 'Failed to make offer');
      }
    } finally {
      setIsActioning(false);
    }
  };

  // Determine if it's the user's turn to respond to an offer
  // If the other person sent the active offer, it's my turn to respond
  const isMyTurn = conversation?.offerStatus === 'active' &&
    conversation?.activeOfferBy === conversation?.otherUserId;

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
          href={fromAdmin ? "/admin" : fromListing && listingIdParam ? `/listing/${listingIdParam}` : "/messages"}
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {fromAdmin ? 'Back to Admin Portal' : fromListing ? 'Back to listing' : 'Back to messages'}
        </Link>

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <MessageSquare className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Sign in to view messages</h2>
            <p className="text-muted-foreground">
              Create an account or sign in to read and send messages.
            </p>
            <Button
              onClick={() => setShowLoginModal(true)}
              className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]"
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
        href={fromAdmin ? "/admin" : fromListing && listingIdParam ? `/listing/${listingIdParam}` : "/messages"}
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {fromAdmin ? 'Back to Admin Portal' : fromListing ? 'Back to listing' : 'Back to messages'}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Area */}
        <div className="lg:col-span-2">
          <Card className="flex flex-col h-[600px]">
            {/* Chat Header */}
            <CardHeader className="border-b py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {conversation?.otherUserName || 'Conversation'}
                  </CardTitle>
                  {conversation?.listingTitle && (
                    <p className="text-sm text-muted-foreground">
                      Re: {conversation.listingTitle}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>

            {/* Messages Area */}
            <CardContent className="flex-1 overflow-y-auto p-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No messages yet. Start the conversation!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => {
                    const prevMessage = index > 0 ? messages[index - 1] : null;
                    const showDateSeparator = shouldShowDateSeparator(message, prevMessage);

                    // This is the active offer if amount and sender match the conversation's active offer
                    const isThisActiveOffer = message.type === 'offer' &&
                      conversation?.offerStatus === 'active' &&
                      message.offerAmount === conversation?.activeOfferAmount &&
                      message.senderId === conversation?.activeOfferBy;

                    // An offer was countered if it's an offer but not the active one (and there is still an active offer)
                    const wasCountered = message.type === 'offer' && !isThisActiveOffer &&
                      conversation?.offerStatus === 'active';

                    return (
                      <div key={message.id}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-4">
                            <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                              {formatDate(message.createdAt)}
                            </div>
                          </div>
                        )}
                        <MessageBubble
                          message={message}
                          isMyTurn={isMyTurn && isThisActiveOffer}
                          isActiveOffer={isThisActiveOffer}
                          wasCountered={wasCountered}
                          onAccept={handleAcceptOffer}
                          onDecline={handleDeclineOffer}
                          onCounter={() => setShowOfferModal(true)}
                          isActioning={isActioning}
                          onImageClick={setLightboxUrl}
                        />
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </CardContent>

            {/* Message Input */}
            <div className="border-t p-4">
              {/* Offer Status Banner */}
              {conversation?.offerStatus === 'active' && (
                <div className="mb-3 p-3 bg-[#6E0114]/10 border border-[#6E0114]/30 rounded-lg">
                  <div className="text-sm text-[#6E0114]">
                    <span className="font-medium">Active offer: </span>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(conversation.activeOfferAmount || 0)}
                    {isMyTurn && <span className="ml-2 opacity-80">(Your turn to respond)</span>}
                  </div>
                </div>
              )}

              {conversation?.offerStatus === 'accepted' && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm text-green-800">
                    <span className="font-medium">Accepted: </span>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(conversation.acceptedAmount || 0)}
                  </div>
                </div>
              )}

              {/* Make Offer Button */}
              {conversation?.listingId && listingPrice && conversation?.offerStatus !== 'active' && conversation?.offerStatus !== 'accepted' && (
                <div className="mb-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowOfferModal(true)}
                    className="flex items-center gap-1"
                  >
                    <Tag className="h-4 w-4" />
                    Make Offer
                  </Button>
                </div>
              )}

              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="h-16 w-16 object-cover rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-[#FFFFF3] rounded-full p-0.5 hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={handleMessageChange}
                      disabled={isSending}
                      rows={2}
                      className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSending || selectedImages.length >= 4}
                      title="Attach images (max 4)"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button
                      type="submit"
                      disabled={(!newMessage.trim() && selectedImages.length === 0) || isSending}
                      className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <span className={`text-xs ${newMessage.length >= MAX_MESSAGE_LENGTH ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {newMessage.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                </div>
              </form>
            </div>
          </Card>
        </div>

        {/* Sidebar - Listing Context */}
        {conversation?.listingId && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">About this listing</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/listing/${conversation.listingId}`} className="block">
                  <div className="relative w-full aspect-square bg-gradient-to-br from-muted to-muted/50 rounded-lg overflow-hidden mb-4">
                    {conversation.listingImage ? (
                      <Image
                        src={conversation.listingImage}
                        alt={conversation.listingTitle || 'Listing'}
                        fill
                        className="object-cover hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <span className="text-6xl">🎸</span>
                      </div>
                    )}
                  </div>
                </Link>

                <Link href={`/listing/${conversation.listingId}`}>
                  <h3 className="font-semibold text-lg mb-3 hover:text-[#6E0114] transition-colors line-clamp-2">
                    {conversation.listingTitle}
                  </h3>
                </Link>

                <div className="space-y-2">
                  <Link href={`/listing/${conversation.listingId}`}>
                    <Button variant="outline" className="w-full">
                      View Listing
                    </Button>
                  </Link>
                  {listingPrice && (
                    <Button
                      variant="outline"
                      className="w-full border-[#6E0114] text-[#6E0114] hover:bg-[#6E0114]/5"
                      onClick={() => setShowOfferModal(true)}
                    >
                      <Tag className="h-4 w-4 mr-2" />
                      Make an Offer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Make Offer Modal */}
      {conversation?.listingId && (listingPrice || conversation?.activeOfferAmount) && (
        <MakeOfferModal
          open={showOfferModal}
          onOpenChange={setShowOfferModal}
          listing={{
            id: conversation.listingId,
            title: conversation.listingTitle || 'Listing',
            price: listingPrice?.price || conversation?.activeOfferAmount || 0,
            currency: listingPrice?.currency || 'USD',
          }}
          onOfferSubmit={handleMakeOffer}
          isCounter={conversation?.offerStatus === 'active' || conversation?.offerStatus === 'declined' || conversation?.offerStatus === 'expired'}
        />
      )}

      {/* Fullscreen Image Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <div
            className="w-full h-full flex items-center justify-center p-4 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxUrl}
              alt="Full size"
              className="max-w-full max-h-full object-contain rounded-lg select-none"
              style={{ touchAction: 'pinch-zoom' }}
              onClick={() => setLightboxUrl(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isMyTurn?: boolean;
  isActiveOffer?: boolean;
  wasCountered?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCounter?: () => void;
  isActioning?: boolean;
  onImageClick?: (url: string) => void;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function MessageBubble({ message, isMyTurn, isActiveOffer, wasCountered, onAccept, onDecline, onCounter, isActioning, onImageClick }: MessageBubbleProps) {
  // Handle system messages (accept, decline, expire)
  if (message.type === 'accept') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
          <span>Offer accepted: {formatPrice(message.offerAmount || 0)}</span>
        </div>
      </div>
    );
  }

  if (message.type === 'decline') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded-full text-sm font-medium">
          Offer declined
        </div>
      </div>
    );
  }

  if (message.type === 'expire') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm font-medium">
          Offer expired
        </div>
      </div>
    );
  }

  if (message.type === 'counter') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
          Offer countered
        </div>
      </div>
    );
  }

  // Handle offer messages
  if (message.type === 'offer') {
    return (
      <div className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[80%] rounded-lg p-4 ${
          message.isMine ? 'bg-[#6E0114] text-[#FFFFF3]' : 'bg-muted text-foreground border border-gray-300'
        }`}>
          <div className="text-xs uppercase tracking-wide opacity-75 mb-1">
            {message.isMine ? 'Your Offer' : 'Their Offer'}
          </div>
          <div className="text-2xl">
            {formatPrice(message.offerAmount || 0)}
          </div>
          {wasCountered && (
            <p className={`text-xs mt-1 ${message.isMine ? 'text-red-200' : 'text-muted-foreground'}`}>
              Countered
            </p>
          )}
          {isActiveOffer && !wasCountered && (
            <p className={`text-xs mt-1 ${message.isMine ? 'text-red-200' : 'text-muted-foreground'}`}>
              {message.isMine ? 'Waiting for seller to respond' : 'Waiting for buyer to respond'}
            </p>
          )}
          <div className={`flex items-center gap-1 text-xs mt-2 ${message.isMine ? 'text-red-200 justify-end' : 'text-muted-foreground'}`}>
            <span>{formatTime(message.createdAt)}</span>
            {message.isMine && (
              message.isRead
                ? <CheckCheck className="h-3.5 w-3.5 text-blue-300" />
                : <Check className="h-3.5 w-3.5" />
            )}
          </div>
          {!message.isMine && isMyTurn && isActiveOffer && !wasCountered && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={onAccept}
                disabled={isActioning}
                className="bg-green-500 hover:bg-green-600 text-[#FFFFF3]"
              >
                Accept
              </Button>
              <Button
                size="sm"
                onClick={onCounter}
                disabled={isActioning}
                className="bg-[#FFFFF3] hover:bg-gray-100 text-[#020E1C] border border-gray-300"
              >
                Counter
              </Button>
              <Button
                size="sm"
                onClick={onDecline}
                disabled={isActioning}
                className="bg-red-500 hover:bg-red-600 text-[#FFFFF3]"
              >
                Decline
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Regular text message
  return (
    <div className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          message.isMine
            ? 'bg-[#6E0114] text-[#FFFFF3]'
            : 'bg-muted text-foreground border border-gray-300'
        }`}
      >
        {/* Display images if present */}
        {message.imageUrls && message.imageUrls.length > 0 && (
          <div className={`grid gap-2 mb-2 ${message.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {message.imageUrls.map((url, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onImageClick?.(url)}
                className="block cursor-zoom-in"
              >
                <img
                  src={url}
                  alt={`Attachment ${index + 1}`}
                  className="rounded-lg max-h-48 w-full object-cover hover:opacity-90 transition-opacity"
                />
              </button>
            ))}
          </div>
        )}
        {message.messageText && (
          <p className="text-sm whitespace-pre-wrap break-words">{linkifyText(message.messageText)}</p>
        )}
        <div
          className={`flex items-center gap-1 text-xs mt-1 ${
            message.isMine ? 'text-red-200 justify-end' : 'text-muted-foreground'
          }`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {message.isMine && (
            message.isRead
              ? <CheckCheck className="h-3.5 w-3.5 text-blue-300" />
              : <Check className="h-3.5 w-3.5" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConversationPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <ConversationPageContent />
    </Suspense>
  );
}
