'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Play, CheckCircle, XCircle, ShieldX, ToggleLeft, ToggleRight, Pencil, Check, X, Tag, Filter, MessageSquare, Send, Circle, ExternalLink, Package, Receipt, ChevronDown, ChevronUp, Copy, TrendingDown, Users } from 'lucide-react';
import { OfferCard, AdminOffer } from '@/components/admin/OfferCard';
import { DealFinderTab } from '@/components/admin/DealFinderTab';
import { UsersTab } from '@/components/admin/UsersTab';
import { NewMessageModal } from '@/components/admin/NewMessageModal';
import { useAuth } from '@/contexts/AuthContext';

interface ScraperResponse {
  success: boolean;
  message: string;
  output?: string[];
  errors?: string[];
  error?: string;
}

interface AdminListing {
  id: string;
  listing_title: string;
  condition: string;
  images: string[];
  price: number;
  currency: string;
  disabled: boolean;
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

interface AdminOrderItem {
  listingId: string;
  listingTitle: string;
  price: number;
  currency: string;
  quantity: number;
}

interface AdminOrderShippingAddress {
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface AdminOrder {
  id: string;
  paymentMethod: string;
  items: AdminOrderItem[];
  shippingAddress: AdminOrderShippingAddress;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
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

export default function AdminPage() {
  const { isAdmin, isLoading, isAuthenticated, setShowLoginModal } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScraperResponse | null>(null);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offerStatusFilter, setOfferStatusFilter] = useState<string>('all');
  const [offerListingFilter, setOfferListingFilter] = useState<string>('all');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [expandedOrderItems, setExpandedOrderItems] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('listings');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);

  // Load active tab from localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem('adminActiveTab');
    if (savedTab && ['listings', 'messages', 'offers', 'orders', 'deals', 'users'].includes(savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  // Save active tab to localStorage when it changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem('adminActiveTab', value);
  };

  const fetchListings = async () => {
    setLoadingListings(true);
    try {
      const data = await api.authGet<AdminListing[]>('/admin/listings');
      setListings(data);
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    } finally {
      setLoadingListings(false);
    }
  };

  const fetchOffers = async () => {
    setLoadingOffers(true);
    try {
      const data = await api.authGet<AdminOffer[]>('/admin/offers');
      setOffers(data);
    } catch (err) {
      console.error('Failed to fetch offers:', err);
    } finally {
      setLoadingOffers(false);
    }
  };

  const fetchConversations = async () => {
    setLoadingConversations(true);
    try {
      const data = await api.authGet<Conversation[]>('/messages/conversations');
      setConversations(data);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await api.authGet<AdminOrder[]>('/admin/orders');
      setOrders(data);
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };
      console.error('Failed to fetch orders:', apiError.message || 'Unknown error', apiError.status ? `(${apiError.status})` : '');
    } finally {
      setLoadingOrders(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatOrderDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const startReply = (conversationId: string) => {
    setReplyingToId(conversationId);
    setReplyText('');
    setTimeout(() => replyInputRef.current?.focus(), 100);
  };

  const cancelReply = () => {
    setReplyingToId(null);
    setReplyText('');
  };

  const sendReply = async (conversation: Conversation) => {
    if (!replyText.trim() || sendingReply || !conversation.otherUserId) return;

    setSendingReply(true);
    try {
      await api.authPost('/messages', {
        recipientId: conversation.otherUserId,
        messageText: replyText.trim(),
        listingId: conversation.listingId,
      });

      // Update the conversation's last message in the list
      setConversations(prev => prev.map(c =>
        c.id === conversation.id
          ? { ...c, lastMessage: replyText.trim(), lastMessageAt: new Date().toISOString() }
          : c
      ));

      setReplyingToId(null);
      setReplyText('');
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSendingReply(false);
    }
  };

  const handleOfferUpdate = (offerId: string, updatedOffer: AdminOffer | null) => {
    if (updatedOffer) {
      setOffers(prev => prev.map(o => o.id === offerId ? updatedOffer : o));
    } else {
      setOffers(prev => prev.filter(o => o.id !== offerId));
    }
  };

  const filteredOffers = offers.filter(offer => {
    if (offerStatusFilter !== 'all' && offer.status !== offerStatusFilter) {
      return false;
    }
    if (offerListingFilter !== 'all' && offer.listingId !== offerListingFilter) {
      return false;
    }
    return true;
  });

  const uniqueListingsInOffers = Array.from(
    new Map(offers.map(o => [o.listingId, { id: o.listingId, title: o.listingTitle }])).values()
  );

  const toggleListing = async (id: string) => {
    setTogglingId(id);
    try {
      const response = await api.authPatch<{ id: string; disabled: boolean }>(`/admin/listings/${id}/toggle-disabled`);
      setListings(prev =>
        prev.map(l => (l.id === id ? { ...l, disabled: response.disabled } : l))
      );
    } catch (err) {
      console.error('Failed to toggle listing:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const startEditPrice = (listing: AdminListing) => {
    setEditingPriceId(listing.id);
    setEditPriceValue(listing.price.toString());
  };

  const cancelEditPrice = () => {
    setEditingPriceId(null);
    setEditPriceValue('');
  };

  const savePrice = async (id: string) => {
    const price = parseFloat(editPriceValue);
    if (isNaN(price) || price <= 0) {
      return;
    }

    setSavingPriceId(id);
    try {
      const response = await api.authPatch<{ id: string; price: number }>(`/admin/listings/${id}/price`, { price });
      setListings(prev =>
        prev.map(l => (l.id === id ? { ...l, price: response.price } : l))
      );
      setEditingPriceId(null);
      setEditPriceValue('');
    } catch (err) {
      console.error('Failed to update price:', err);
    } finally {
      setSavingPriceId(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchListings();
      fetchOffers();
      fetchConversations();
      fetchOrders();
    }
  }, [isAdmin]);

  const runScraper = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await api.authPost<ScraperResponse>('/admin/run-scraper', {});
      setResult(response);
    } catch (err) {
      setResult({
        success: false,
        message: 'Failed to run scraper',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-red-100 p-3 rounded-full">
              <ShieldX className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Access Denied</h1>
          <p className="text-gray-600 text-center mb-6">
            {isAuthenticated
              ? "You don't have permission to access the admin portal."
              : "Please sign in with an admin account to access this page."
            }
          </p>

          <div className="space-y-3">
            {!isAuthenticated && (
              <Button
                onClick={() => setShowLoginModal(true)}
                className="w-full bg-[#df5e15] hover:bg-[#c54d0a] text-white font-semibold py-3"
              >
                Sign In
              </Button>
            )}
            <Link href="/" className="block">
              <Button
                variant="outline"
                className="w-full py-3"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Portal</h1>
      <p className="text-gray-600 mb-6">Manage your guitar listings database</p>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-6 mb-6">
          <TabsTrigger value="listings" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Listings</span>
          </TabsTrigger>
          <TabsTrigger value="deals" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            <span className="hidden sm:inline">Deals</span>
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Messages</span>
            {conversations.reduce((sum, c) => sum + c.unreadCount, 0) > 0 && (
              <span className="px-1.5 py-0.5 bg-[#df5e15] text-white rounded-full text-xs">
                {conversations.reduce((sum, c) => sum + c.unreadCount, 0)}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="offers" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Offers</span>
            {offers.filter(o => o.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.5 bg-yellow-500 text-white rounded-full text-xs">
                {offers.filter(o => o.status === 'pending').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Orders</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
        </TabsList>

        {/* Manage Listings Tab */}
        <TabsContent value="listings">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Manage Listings</h2>
                <p className="text-gray-600 text-sm mt-1">Enable or disable listings manually</p>
              </div>
              <Button
                onClick={fetchListings}
                disabled={loadingListings}
                variant="outline"
                className="text-sm"
              >
                {loadingListings ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
              </Button>
            </div>

            {loadingListings && listings.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : listings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No listings found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Image</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Title</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Condition</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Price</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((listing) => (
                      <tr key={listing.id} className={`border-b border-gray-100 ${listing.disabled ? 'bg-gray-50 opacity-60' : ''}`}>
                        <td className="py-3 px-2">
                          {listing.images?.[0] ? (
                            <Image
                              src={listing.images[0]}
                              alt={listing.listing_title}
                              width={48}
                              height={48}
                              className="rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded" />
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-medium text-gray-900 line-clamp-2">{listing.listing_title}</span>
                        </td>
                        <td className="py-3 px-2 text-gray-600">{listing.condition || '-'}</td>
                        <td className="py-3 px-2">
                          {editingPriceId === listing.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-900">$</span>
                              <input
                                type="number"
                                value={editPriceValue}
                                onChange={(e) => setEditPriceValue(e.target.value)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#df5e15] focus:border-transparent outline-none"
                                min="0.01"
                                step="0.01"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') savePrice(listing.id);
                                  if (e.key === 'Escape') cancelEditPrice();
                                }}
                              />
                              <button
                                onClick={() => savePrice(listing.id)}
                                disabled={savingPriceId === listing.id}
                                className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                                title="Save"
                              >
                                {savingPriceId === listing.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={cancelEditPrice}
                                className="p-1 text-gray-500 hover:text-gray-700"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 font-medium">${listing.price.toLocaleString()}</span>
                              <button
                                onClick={() => startEditPrice(listing)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                                title="Edit price"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {listing.disabled ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              Disabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <a
                              href={`/listing/${listing.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                            <button
                              onClick={() => toggleListing(listing.id)}
                              disabled={togglingId === listing.id}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                listing.disabled
                                  ? 'bg-green-600 hover:bg-green-700 text-white'
                                  : 'bg-gray-600 hover:bg-gray-700 text-white'
                              } disabled:opacity-50`}
                            >
                              {togglingId === listing.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : listing.disabled ? (
                                <>
                                  <ToggleRight className="h-3 w-3" />
                                  Enable
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="h-3 w-3" />
                                  Disable
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Reverb Scraper - at the bottom of Manage Listings tab */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Reverb Scraper</h2>
            <p className="text-gray-600 mb-6">
              Manually trigger the scraper to refresh your listings from Reverb. This will fetch all
              current listings and update the database.
            </p>

            <Button
              onClick={runScraper}
              disabled={loading}
              className="bg-[#df5e15] hover:bg-[#c54d0a] text-white font-semibold px-6 py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Running Scraper...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Run Scraper
                </>
              )}
            </Button>

            {result && (
              <div className="mt-6">
                <div
                  className={`flex items-center gap-2 p-4 rounded-lg ${
                    result.success
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 flex-shrink-0" />
                  )}
                  <span className="font-medium">{result.message}</span>
                </div>

                {result.output && result.output.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Output:</h3>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-96 overflow-y-auto">
                      {result.output.join('\n')}
                    </pre>
                  </div>
                )}

                {result.errors && result.errors.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-red-700 mb-2">Errors:</h3>
                    <pre className="bg-red-900 text-red-100 p-4 rounded-lg text-sm overflow-x-auto max-h-48 overflow-y-auto">
                      {result.errors.join('\n')}
                    </pre>
                  </div>
                )}

                {result.error && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-red-700 mb-2">Error Details:</h3>
                    <pre className="bg-red-50 text-red-800 p-4 rounded-lg text-sm">{result.error}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Deals Tab */}
        <TabsContent value="deals">
          <DealFinderTab />
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Customer Messages
                </h2>
                <p className="text-gray-600 text-sm mt-1">View and respond to customer inquiries</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => setShowNewMessageModal(true)}
                  className="bg-[#df5e15] hover:bg-[#c54d0a] text-white text-sm"
                >
                  <Send className="h-4 w-4 mr-2" />
                  New Message
                </Button>
                <Button
                  onClick={fetchConversations}
                  disabled={loadingConversations}
                  variant="outline"
                  className="text-sm"
                >
                  {loadingConversations ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                </Button>
              </div>
            </div>

            {/* Messages count */}
            <div className="mb-4">
              <span className="text-sm text-gray-500">
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                {conversations.reduce((sum, c) => sum + c.unreadCount, 0) > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs">
                    {conversations.reduce((sum, c) => sum + c.unreadCount, 0)} unread
                  </span>
                )}
              </span>
            </div>

            {loadingConversations && conversations.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No messages yet</p>
                <p className="text-gray-400 text-sm">When customers send messages, they&apos;ll appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.map(conversation => (
                  <div
                    key={conversation.id}
                    className={`border rounded-lg p-4 ${conversation.unreadCount > 0 ? 'bg-orange-50 border-orange-200' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Listing Image */}
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
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
                            <span className="font-semibold text-gray-900 truncate">
                              {conversation.otherUserName}
                            </span>
                            {conversation.unreadCount > 0 && (
                              <span className="px-2 py-0.5 bg-[#df5e15] text-white rounded-full text-xs flex-shrink-0">
                                {conversation.unreadCount} new
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatTimeAgo(conversation.lastMessageAt)}
                          </span>
                        </div>

                        {conversation.listingTitle && (
                          <p className="text-sm text-gray-500 truncate mb-1">
                            Re: {conversation.listingTitle}
                          </p>
                        )}

                        <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                          {conversation.lastMessage || 'No messages yet'}
                        </p>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {replyingToId === conversation.id ? (
                            <div className="flex flex-wrap items-center gap-2 w-full">
                              <Input
                                ref={replyInputRef}
                                type="text"
                                placeholder="Type a quick reply..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                disabled={sendingReply}
                                className="flex-1 min-w-0 text-sm h-8"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') sendReply(conversation);
                                  if (e.key === 'Escape') cancelReply();
                                }}
                              />
                              <Button
                                size="sm"
                                onClick={() => sendReply(conversation)}
                                disabled={!replyText.trim() || sendingReply}
                                className="bg-[#df5e15] hover:bg-[#c54d0a] text-white h-8 px-3"
                              >
                                {sendingReply ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelReply}
                                className="h-8 px-3"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startReply(conversation.id)}
                                className="text-xs h-7"
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Quick Reply
                              </Button>
                              <Link href={`/messages/${conversation.id}`}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  View Full Chat
                                </Button>
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* New Message Modal */}
          <NewMessageModal
            isOpen={showNewMessageModal}
            onClose={() => setShowNewMessageModal(false)}
            onConversationCreated={fetchConversations}
          />
        </TabsContent>

        {/* Offers Tab */}
        <TabsContent value="offers">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Manage Offers
                </h2>
                <p className="text-gray-600 text-sm mt-1">Review and respond to buyer offers</p>
              </div>
              <Button
                onClick={fetchOffers}
                disabled={loadingOffers}
                variant="outline"
                className="text-sm"
              >
                {loadingOffers ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Filters:</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Status:</label>
                <select
                  value={offerStatusFilter}
                  onChange={(e) => setOfferStatusFilter(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-[#df5e15] focus:border-transparent outline-none"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="countered">Countered</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Listing:</label>
                <select
                  value={offerListingFilter}
                  onChange={(e) => setOfferListingFilter(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-[#df5e15] focus:border-transparent outline-none max-w-[200px]"
                >
                  <option value="all">All Listings</option>
                  {uniqueListingsInOffers.map(listing => (
                    <option key={listing.id} value={listing.id}>
                      {listing.title.length > 30 ? listing.title.substring(0, 30) + '...' : listing.title}
                    </option>
                  ))}
                </select>
              </div>
              {(offerStatusFilter !== 'all' || offerListingFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOfferStatusFilter('all');
                    setOfferListingFilter('all');
                  }}
                  className="text-xs"
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Offers count */}
            <div className="mb-4">
              <span className="text-sm text-gray-500">
                Showing {filteredOffers.length} of {offers.length} offers
                {offers.filter(o => o.status === 'pending').length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                    {offers.filter(o => o.status === 'pending').length} pending
                  </span>
                )}
              </span>
            </div>

            {loadingOffers && offers.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : offers.length === 0 ? (
              <div className="text-center py-8">
                <Tag className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No offers yet</p>
                <p className="text-gray-400 text-sm">When buyers make offers, they&apos;ll appear here</p>
              </div>
            ) : filteredOffers.length === 0 ? (
              <div className="text-center py-8">
                <Filter className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No offers match your filters</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOfferStatusFilter('all');
                    setOfferListingFilter('all');
                  }}
                  className="mt-2"
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredOffers.map(offer => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    onUpdate={handleOfferUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  All Orders
                </h2>
                <p className="text-gray-600 text-sm mt-1">View all customer orders</p>
              </div>
              <Button
                onClick={fetchOrders}
                disabled={loadingOrders}
                variant="outline"
                className="text-sm"
              >
                {loadingOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
              </Button>
            </div>

            {/* Orders count */}
            <div className="mb-4">
              <span className="text-sm text-gray-500">
                {orders.length} order{orders.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loadingOrders && orders.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No orders yet</p>
                <p className="text-gray-400 text-sm">When customers complete purchases, they&apos;ll appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Order ID</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Date</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Buyer</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Items</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Total</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Payment</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-gray-600" title={order.id}>
                              {order.id.substring(0, 8)}...
                            </span>
                            <button
                              onClick={() => copyToClipboard(order.id)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Copy full ID"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-gray-600 text-xs whitespace-nowrap">
                            {formatOrderDate(order.createdAt)}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{order.buyerName || 'Guest'}</p>
                            <p className="text-xs text-gray-500">{order.buyerEmail}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="space-y-1">
                            {expandedOrderItems === order.id ? (
                              <>
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="text-xs">
                                    <span className="text-gray-900 break-words">
                                      {item.listingTitle}
                                    </span>
                                    <span className="text-gray-500 ml-1">
                                      ({item.quantity}x ${item.price.toLocaleString()})
                                    </span>
                                  </div>
                                ))}
                                <button
                                  onClick={() => setExpandedOrderItems(null)}
                                  className="text-xs text-[#df5e15] hover:underline"
                                >
                                  Collapse
                                </button>
                              </>
                            ) : (
                              <>
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="text-xs">
                                    <span className="text-gray-900 line-clamp-1" title={item.listingTitle}>
                                      {item.listingTitle.length > 25 ? item.listingTitle.substring(0, 25) + '...' : item.listingTitle}
                                    </span>
                                    <span className="text-gray-500 ml-1">
                                      ({item.quantity}x ${item.price.toLocaleString()})
                                    </span>
                                  </div>
                                ))}
                                <button
                                  onClick={() => setExpandedOrderItems(order.id)}
                                  className="text-xs text-[#df5e15] hover:underline"
                                >
                                  Expand
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-semibold text-gray-900">
                            ${order.totalAmount.toLocaleString()}
                          </span>
                          <span className="text-gray-500 text-xs ml-1">{order.currency}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            order.paymentMethod === 'stripe'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {order.paymentMethod === 'stripe' ? 'Stripe' : 'PayPal'}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            order.status === 'completed' || order.status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : order.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <button
                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                          >
                            {expandedOrderId === order.id ? (
                              <>
                                <ChevronUp className="h-3 w-3" />
                                Hide
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" />
                                View
                              </>
                            )}
                          </button>
                          {expandedOrderId === order.id && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                              <p className="font-medium">{order.shippingAddress.fullName}</p>
                              <p>{order.shippingAddress.line1}</p>
                              {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                              <p>
                                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                              </p>
                              <p>{order.shippingAddress.country}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
