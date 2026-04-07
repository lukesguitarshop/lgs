'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Play, CheckCircle, XCircle, ShieldX, ToggleLeft, ToggleRight, Pencil, Check, X, Tag, Filter, MessageSquare, Send, Circle, ExternalLink, Package, Receipt, ChevronDown, ChevronUp, Copy, TrendingDown, Users, Trash2, Settings, DollarSign, ArrowLeftRight, BarChart3, Calendar, Calculator } from 'lucide-react';
import { DealFinderTab } from '@/components/admin/DealFinderTab';
import { SweetwaterDealFinderTab } from '@/components/admin/SweetwaterDealFinderTab';
import { UsersTab } from '@/components/admin/UsersTab';
import { NewMessageModal } from '@/components/admin/NewMessageModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import TransactionsTab from '@/components/admin/TransactionsTab';
import DashboardTab from '@/components/admin/DashboardTab';
import MonthlyBreakdownTab from '@/components/admin/MonthlyBreakdownTab';
import ExtraExpensesTab from '@/components/admin/ExtraExpensesTab';
import FlipCalculatorTab from '@/components/admin/FlipCalculatorTab';

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

interface ConversationOffer {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string | null;
  listingId: string | null;
  listingTitle: string | null;
  listingImage: string | null;
  listingPrice: number | null;
  activeOfferAmount: number | null;
  activeOfferBy: string | null;
  pendingActionBy: string | null;
  offerExpiresAt: string | null;
  offerStatus: string | null;
  acceptedAmount: number | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
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
  trackingCarrier: string | null;
  trackingNumber: string | null;
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
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScraperResponse | null>(null);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [conversationOffers, setConversationOffers] = useState<ConversationOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offerStatusFilter, setOfferStatusFilter] = useState<string>('all');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [expandedOrderItems, setExpandedOrderItems] = useState<string | null>(null);
  const [editingTrackingId, setEditingTrackingId] = useState<string | null>(null);
  const [trackingCarrier, setTrackingCarrier] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [savingTracking, setSavingTracking] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('listings');
  const [adminSection, setAdminSection] = useState<'operations' | 'finances'>('operations');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reviewScraperLoading, setReviewScraperLoading] = useState(false);
  const [reviewScraperResult, setReviewScraperResult] = useState<ScraperResponse | null>(null);
  const [initPricesLoading, setInitPricesLoading] = useState(false);
  const lastKnownOrderCountRef = useRef<number | null>(null);
  const initialLoadDoneRef = useRef(false);

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

  // Load admin section from localStorage on mount
  useEffect(() => {
    const savedSection = localStorage.getItem('adminSection');
    if (savedSection && ['operations', 'finances'].includes(savedSection)) {
      setAdminSection(savedSection as 'operations' | 'finances');
    }
  }, []);

  const handleSectionChange = (value: string) => {
    setAdminSection(value as 'operations' | 'finances');
    localStorage.setItem('adminSection', value);
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
      const data = await api.authGet<ConversationOffer[]>('/admin/conversation-offers');
      setConversationOffers(data);
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

  const startEditTracking = (order: AdminOrder) => {
    setEditingTrackingId(order.id);
    setTrackingCarrier(order.trackingCarrier || '');
    setTrackingNumber(order.trackingNumber || '');
  };

  const cancelEditTracking = () => {
    setEditingTrackingId(null);
    setTrackingCarrier('');
    setTrackingNumber('');
  };

  const saveTracking = async (orderId: string) => {
    setSavingTracking(true);
    try {
      await api.authPatch(`/admin/orders/${orderId}/tracking`, {
        trackingCarrier: trackingCarrier || null,
        trackingNumber: trackingNumber || null,
      });
      // Update local state - also set status to "shipped" if tracking is added
      const newStatus = trackingCarrier && trackingNumber ? 'shipped' : undefined;
      setOrders(orders.map(o =>
        o.id === orderId
          ? {
              ...o,
              trackingCarrier: trackingCarrier || null,
              trackingNumber: trackingNumber || null,
              ...(newStatus && { status: newStatus })
            }
          : o
      ));
      cancelEditTracking();
    } catch (err) {
      console.error('Failed to save tracking:', err);
    } finally {
      setSavingTracking(false);
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

  const getStatusDisplay = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'paid':
        return 'Payment Received';
      case 'shipped':
        return 'Shipped';
      case 'delivered':
        return 'Delivered';
      default:
        return status;
    }
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

  const filteredConversationOffers = conversationOffers.filter(offer => {
    if (offerStatusFilter !== 'all' && offer.offerStatus !== offerStatusFilter) {
      return false;
    }
    return true;
  });

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

  const deleteListing = async (listing: AdminListing) => {
    if (!confirm(`Are you sure you want to permanently delete "${listing.listing_title}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(listing.id);
    try {
      await api.authDelete(`/admin/listings/${listing.id}`);
      setListings(prev => prev.filter(l => l.id !== listing.id));
    } catch (err) {
      console.error('Failed to delete listing:', err);
      alert('Failed to delete listing');
    } finally {
      setDeletingId(null);
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

  // Poll for new orders and show toast notification
  const checkForNewOrders = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const data = await api.authGet<AdminOrder[]>('/admin/orders');
      const newOrderCount = data.length;

      // Only show toast if this isn't the initial load and there are new orders
      if (initialLoadDoneRef.current && lastKnownOrderCountRef.current !== null) {
        const newOrdersAdded = newOrderCount - lastKnownOrderCountRef.current;
        if (newOrdersAdded > 0) {
          const message = newOrdersAdded === 1
            ? 'New order received!'
            : `${newOrdersAdded} new orders received!`;
          showToast(message, 'success', 8000);
          // Update the orders state with the new data
          setOrders(data);
        }
      } else {
        initialLoadDoneRef.current = true;
      }

      lastKnownOrderCountRef.current = newOrderCount;
    } catch (err) {
      console.error('Failed to check for new orders:', err);
    }
  }, [isAdmin, showToast]);

  // Set initial order count when orders are first loaded
  useEffect(() => {
    if (orders.length > 0 && lastKnownOrderCountRef.current === null) {
      lastKnownOrderCountRef.current = orders.length;
      initialLoadDoneRef.current = true;
    }
  }, [orders.length]);

  // Poll for new orders every 30 seconds
  useEffect(() => {
    if (!isAdmin) return;

    const interval = setInterval(checkForNewOrders, 30000);
    return () => clearInterval(interval);
  }, [isAdmin, checkForNewOrders]);

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

  const runReviewScraper = async () => {
    setReviewScraperLoading(true);
    setReviewScraperResult(null);

    try {
      const response = await api.authPost<ScraperResponse>('/admin/run-review-scraper', {});
      setReviewScraperResult(response);
    } catch (err) {
      setReviewScraperResult({
        success: false,
        message: 'Failed to run review scraper',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setReviewScraperLoading(false);
    }
  };

  const initializeOriginalPrices = async () => {
    setInitPricesLoading(true);
    try {
      const response = await api.authPost<{ success: boolean; message: string; updatedCount: number }>('/admin/initialize-original-prices', {});
      alert(response.message);
    } catch (err) {
      alert('Failed to initialize prices: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setInitPricesLoading(false);
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
        <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-red-100 p-3 rounded-full">
              <ShieldX className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#020E1C] text-center mb-2">Access Denied</h1>
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
                className="w-full bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold py-3"
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
    <div className="max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-[#020E1C] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-[#020E1C] mb-2">Admin Portal</h1>
      <p className="text-gray-600 mb-6">Manage your guitar listings database</p>

      {/* Top-level section tabs */}
      <Tabs value={adminSection} onValueChange={handleSectionChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="operations" className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            <span>Operations</span>
          </TabsTrigger>
          <TabsTrigger value="finances" className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            <span>Finances</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operations">
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
              <span className="px-1.5 py-0.5 bg-[#6E0114] text-[#FFFFF3] rounded-full text-xs">
                {conversations.reduce((sum, c) => sum + c.unreadCount, 0)}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="offers" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Offers</span>
            {conversationOffers.filter(o => o.offerStatus === 'active').length > 0 && (
              <span className="px-1.5 py-0.5 bg-yellow-500 text-[#FFFFF3] rounded-full text-xs">
                {conversationOffers.filter(o => o.offerStatus === 'active').length}
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
          <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-[#020E1C]">Manage Listings</h2>
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
                          <span className="font-medium text-[#020E1C] line-clamp-2">{listing.listing_title}</span>
                        </td>
                        <td className="py-3 px-2 text-gray-600">{listing.condition || '-'}</td>
                        <td className="py-3 px-2">
                          {editingPriceId === listing.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[#020E1C]">$</span>
                              <input
                                type="number"
                                value={editPriceValue}
                                onChange={(e) => setEditPriceValue(e.target.value)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#6E0114] focus:border-transparent outline-none"
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
                              <span className="text-[#020E1C] font-medium">${listing.price.toLocaleString()}</span>
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
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium text-gray-600 hover:text-[#020E1C] hover:bg-gray-100 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                            <button
                              onClick={() => toggleListing(listing.id)}
                              disabled={togglingId === listing.id}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                listing.disabled
                                  ? 'bg-green-600 hover:bg-green-700 text-[#FFFFF3]'
                                  : 'bg-gray-600 hover:bg-gray-700 text-[#FFFFF3]'
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
                            <button
                              onClick={() => deleteListing(listing)}
                              disabled={deletingId === listing.id}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium text-red-600 hover:text-[#FFFFF3] hover:bg-red-600 transition-colors disabled:opacity-50"
                              title="Delete listing"
                            >
                              {deletingId === listing.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
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
          <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6 mt-6">
            <h2 className="text-xl font-semibold text-[#020E1C] mb-4">Reverb Scraper</h2>
            <p className="text-gray-600 mb-6">
              Manually trigger the scraper to refresh your listings from Reverb. This will fetch all
              current listings and update the database.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={runScraper}
                disabled={loading}
                className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold px-6 py-3"
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
              <Button
                onClick={initializeOriginalPrices}
                disabled={initPricesLoading}
                variant="outline"
                className="font-semibold px-6 py-3"
              >
                {initPricesLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  'Initialize Sale Prices'
                )}
              </Button>
            </div>

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

          {/* Review Scraper */}
          <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6 mt-6">
            <h2 className="text-xl font-semibold text-[#020E1C] mb-4">Review Scraper</h2>
            <p className="text-gray-600 mb-6">
              Fetch reviews from your Reverb shop feedback. Only imports new reviews that haven&apos;t been imported yet.
            </p>

            <Button
              onClick={runReviewScraper}
              disabled={reviewScraperLoading}
              className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold px-6 py-3"
            >
              {reviewScraperLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Fetching Reviews...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Run Review Scraper
                </>
              )}
            </Button>

            {reviewScraperResult && (
              <div className="mt-6">
                <div
                  className={`flex items-center gap-2 p-4 rounded-lg ${
                    reviewScraperResult.success
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  {reviewScraperResult.success ? (
                    <CheckCircle className="h-5 w-5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 flex-shrink-0" />
                  )}
                  <span className="font-medium">{reviewScraperResult.message}</span>
                </div>

                {reviewScraperResult.output && reviewScraperResult.output.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Output:</h3>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-96 overflow-y-auto">
                      {reviewScraperResult.output.join('\n')}
                    </pre>
                  </div>
                )}

                {reviewScraperResult.error && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-red-700 mb-2">Error Details:</h3>
                    <pre className="bg-red-50 text-red-800 p-4 rounded-lg text-sm">{reviewScraperResult.error}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Deals Tab */}
        <TabsContent value="deals">
          <DealFinderTab />
          <div className="mt-6">
            <SweetwaterDealFinderTab />
          </div>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-[#020E1C] flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Customer Messages
                </h2>
                <p className="text-gray-600 text-sm mt-1">View and respond to customer inquiries</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => setShowNewMessageModal(true)}
                  className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] text-sm"
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
                  <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-900 rounded-full text-xs">
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
                    className={`border rounded-lg p-4 ${conversation.unreadCount > 0 ? 'bg-red-50 border-red-200' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Listing Image */}
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {conversation.listingImage ? (
                          <Image
                            src={conversation.listingImage}
                            alt={conversation.listingTitle || 'Listing'}
                            fill
                            sizes="64px"
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
                              <Circle className="h-2 w-2 fill-[#6E0114] text-[#6E0114] flex-shrink-0" />
                            )}
                            <span className="font-semibold text-[#020E1C] truncate">
                              {conversation.otherUserName}
                            </span>
                            {conversation.unreadCount > 0 && (
                              <span className="px-2 py-0.5 bg-[#6E0114] text-[#FFFFF3] rounded-full text-xs flex-shrink-0">
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

                        <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'font-medium text-[#020E1C]' : 'text-gray-600'}`}>
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
                                className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] h-8 px-3"
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
                              <Link href={`/messages/${conversation.id}?from=admin`}>
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
          <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-[#020E1C] flex items-center gap-2">
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
                <span className="text-sm text-gray-600">Filter:</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Status:</label>
                <select
                  value={offerStatusFilter}
                  onChange={(e) => setOfferStatusFilter(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-[#6E0114] focus:border-transparent outline-none"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              {offerStatusFilter !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOfferStatusFilter('all')}
                  className="text-xs"
                >
                  Clear Filter
                </Button>
              )}
            </div>

            {/* Offers count */}
            <div className="mb-4">
              <span className="text-sm text-gray-500">
                Showing {filteredConversationOffers.length} of {conversationOffers.length} offers
                {conversationOffers.filter(o => o.offerStatus === 'active').length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-900 rounded-full text-xs">
                    {conversationOffers.filter(o => o.offerStatus === 'active').length} active
                  </span>
                )}
              </span>
            </div>

            {loadingOffers && conversationOffers.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : conversationOffers.length === 0 ? (
              <div className="text-center py-8">
                <Tag className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No offers yet</p>
                <p className="text-gray-400 text-sm">When buyers make offers, they&apos;ll appear here</p>
              </div>
            ) : filteredConversationOffers.length === 0 ? (
              <div className="text-center py-8">
                <Filter className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No offers match your filter</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOfferStatusFilter('all')}
                  className="mt-2"
                >
                  Clear Filter
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredConversationOffers.map(offer => (
                  <Link key={offer.id} href={`/messages/${offer.id}?from=admin`}>
                    <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-[#6E0114] hover:shadow-sm transition-all cursor-pointer">
                      {/* Listing Image */}
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {offer.listingImage ? (
                          <Image
                            src={offer.listingImage}
                            alt={offer.listingTitle || 'Listing'}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🎸
                          </div>
                        )}
                      </div>

                      {/* Offer Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-[#020E1C] truncate">
                            {offer.buyerName}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            offer.offerStatus === 'active' ? 'bg-red-100 text-red-900' :
                            offer.offerStatus === 'accepted' ? 'bg-green-100 text-green-800' :
                            offer.offerStatus === 'declined' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {offer.offerStatus}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate mb-1">
                          {offer.listingTitle || 'Unknown Listing'}
                        </p>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="font-semibold text-[#6E0114]">
                            {offer.offerStatus === 'accepted'
                              ? `Accepted: $${offer.acceptedAmount?.toLocaleString()}`
                              : offer.activeOfferAmount
                                ? `Offer: $${offer.activeOfferAmount.toLocaleString()}`
                                : 'No active offer'
                            }
                          </span>
                          {offer.listingPrice && (
                            <span className="text-gray-400">
                              Listed: ${offer.listingPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs text-gray-400">
                          {formatTimeAgo(offer.lastMessageAt)}
                        </span>
                        <div className="mt-1">
                          <ExternalLink className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-[#020E1C] flex items-center gap-2">
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
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Tracking</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/order/${order.id}`}
                              className="font-mono text-xs text-[#6E0114] hover:underline"
                              title={order.id}
                            >
                              {order.id.substring(0, 8)}...
                            </Link>
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
                            <p className="font-medium text-[#020E1C] text-sm">{order.buyerName || 'Guest'}</p>
                            <p className="text-xs text-gray-500">{order.buyerEmail}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="space-y-1">
                            {expandedOrderItems === order.id ? (
                              <>
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="text-xs">
                                    <span className="text-[#020E1C] break-words">
                                      {item.listingTitle}
                                    </span>
                                    <span className="text-gray-500 ml-1">
                                      ({item.quantity}x ${item.price.toLocaleString()})
                                    </span>
                                  </div>
                                ))}
                                <button
                                  onClick={() => setExpandedOrderItems(null)}
                                  className="text-xs text-[#6E0114] hover:underline"
                                >
                                  Collapse
                                </button>
                              </>
                            ) : (
                              <>
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="text-xs">
                                    <span className="text-[#020E1C] line-clamp-1" title={item.listingTitle}>
                                      {item.listingTitle.length > 25 ? item.listingTitle.substring(0, 25) + '...' : item.listingTitle}
                                    </span>
                                    <span className="text-gray-500 ml-1">
                                      ({item.quantity}x ${item.price.toLocaleString()})
                                    </span>
                                  </div>
                                ))}
                                <button
                                  onClick={() => setExpandedOrderItems(order.id)}
                                  className="text-xs text-[#6E0114] hover:underline"
                                >
                                  Expand
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="font-semibold text-[#020E1C]">
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
                            order.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {getStatusDisplay(order.status)}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          {editingTrackingId === order.id ? (
                            <div className="space-y-2">
                              <select
                                value={trackingCarrier}
                                onChange={(e) => setTrackingCarrier(e.target.value)}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                              >
                                <option value="">Select carrier...</option>
                                <option value="UPS">UPS</option>
                                <option value="USPS">USPS</option>
                                <option value="FedEx">FedEx</option>
                              </select>
                              <input
                                type="text"
                                value={trackingNumber}
                                onChange={(e) => setTrackingNumber(e.target.value)}
                                placeholder="Tracking number"
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                              />
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => saveTracking(order.id)}
                                  disabled={savingTracking}
                                  className="text-xs h-6 px-2 bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]"
                                >
                                  {savingTracking ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditTracking}
                                  disabled={savingTracking}
                                  className="text-xs h-6 px-2"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : order.trackingCarrier && order.trackingNumber ? (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-[#020E1C]">{order.trackingCarrier}</p>
                              <p className="text-xs text-gray-600 font-mono">{order.trackingNumber}</p>
                              <button
                                onClick={() => startEditTracking(order)}
                                className="text-xs text-[#6E0114] hover:underline"
                              >
                                Edit
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditTracking(order)}
                              className="text-xs text-[#6E0114] hover:underline"
                            >
                              Add tracking
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <button
                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                            className="flex items-center gap-1 text-xs text-gray-600 hover:text-[#020E1C]"
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
        </TabsContent>

        <TabsContent value="finances">
          <FinancesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FinancesSection() {
  const [financeTab, setFinanceTab] = useState('transactions');

  useEffect(() => {
    const saved = localStorage.getItem('adminFinanceTab');
    if (saved && ['transactions', 'dashboard', 'monthly', 'expenses', 'flip-calc'].includes(saved)) {
      setFinanceTab(saved);
    }
  }, []);

  const handleFinanceTabChange = (value: string) => {
    setFinanceTab(value);
    localStorage.setItem('adminFinanceTab', value);
  };

  return (
    <Tabs value={financeTab} onValueChange={handleFinanceTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-5 mb-6">
        <TabsTrigger value="transactions" className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" />
          <span className="hidden sm:inline">Transactions</span>
        </TabsTrigger>
        <TabsTrigger value="dashboard" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </TabsTrigger>
        <TabsTrigger value="monthly" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Monthly</span>
        </TabsTrigger>
        <TabsTrigger value="expenses" className="flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          <span className="hidden sm:inline">Expenses</span>
        </TabsTrigger>
        <TabsTrigger value="flip-calc" className="flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          <span className="hidden sm:inline">Flip Calc</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="transactions">
        <TransactionsTab />
      </TabsContent>
      <TabsContent value="dashboard">
        <DashboardTab />
      </TabsContent>
      <TabsContent value="monthly">
        <MonthlyBreakdownTab />
      </TabsContent>
      <TabsContent value="expenses">
        <ExtraExpensesTab />
      </TabsContent>
      <TabsContent value="flip-calc">
        <FlipCalculatorTab />
      </TabsContent>
    </Tabs>
  );
}
