'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, MessageSquare, Send, User, Tag, Paperclip, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
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

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const { isAuthenticated, isLoading: authLoading, setShowLoginModal } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [listingPrice, setListingPrice] = useState<{ price: number; currency: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const MAX_MESSAGE_LENGTH = 500;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
        const listing = await api.get<{ price: number; currency: string; disabled?: boolean }>(`/mylistings/${conversation.listingId}`);
        // Only set price if listing exists and is not disabled (sold)
        if (listing && listing.price && !listing.disabled) {
          setListingPrice({ price: listing.price, currency: listing.currency });
        } else {
          setListingPrice(null);
        }
      } catch {
        // Silently handle - listing may be sold or deleted
        // The Make Offer button simply won't appear
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
          href="/messages"
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to messages
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
        href="/messages"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to messages
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

                    return (
                      <div key={message.id}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-4">
                            <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                              {formatDate(message.createdAt)}
                            </div>
                          </div>
                        )}
                        <MessageBubble message={message} />
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </CardContent>

            {/* Message Input */}
            <div className="border-t p-4">
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
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
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
                      className="bg-[#df5e15] hover:bg-[#c54d0a] text-white"
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
                  <h3 className="font-semibold text-lg mb-3 hover:text-[#df5e15] transition-colors line-clamp-2">
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
                      className="w-full border-[#df5e15] text-[#df5e15] hover:bg-[#df5e15]/5"
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
      {conversation?.listingId && listingPrice && (
        <MakeOfferModal
          open={showOfferModal}
          onOpenChange={setShowOfferModal}
          listing={{
            id: conversation.listingId,
            title: conversation.listingTitle || 'Listing',
            price: listingPrice.price,
            currency: listingPrice.currency,
          }}
        />
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          message.isMine
            ? 'bg-[#df5e15] text-white'
            : 'bg-muted text-foreground'
        }`}
      >
        {/* Display images if present */}
        {message.imageUrls && message.imageUrls.length > 0 && (
          <div className={`grid gap-2 mb-2 ${message.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {message.imageUrls.map((url, index) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={url}
                  alt={`Attachment ${index + 1}`}
                  className="rounded-lg max-h-48 w-full object-cover hover:opacity-90 transition-opacity"
                />
              </a>
            ))}
          </div>
        )}
        {message.messageText && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.messageText}</p>
        )}
        <p
          className={`text-xs mt-1 ${
            message.isMine ? 'text-orange-200' : 'text-muted-foreground'
          }`}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
