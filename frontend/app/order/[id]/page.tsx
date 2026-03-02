'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  Package,
  User,
  MapPin,
  CreditCard,
  Truck,
  Calendar,
  ExternalLink,
  Mail,
  CheckCircle,
} from 'lucide-react';

interface OrderItem {
  listingId: string;
  listingTitle: string;
  price: number;
  currency: string;
  quantity: number;
}

interface ShippingAddress {
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface Order {
  id: string;
  paymentMethod: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  trackingCarrier: string | null;
  trackingNumber: string | null;
}

function getTrackingUrl(carrier: string, trackingNumber: string): string | null {
  switch (carrier.toUpperCase()) {
    case 'UPS':
      return `https://www.ups.com/track?tracknum=${trackingNumber}`;
    case 'USPS':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
    case 'FEDEX':
      return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
    default:
      return null;
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

function getStatusDisplay(status: string): string {
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
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tracking edit state
  const [editingTracking, setEditingTracking] = useState(false);
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [savingTracking, setSavingTracking] = useState(false);

  // Status update state
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Copy state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/');
    }
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId || !isAdmin) return;

      try {
        setLoading(true);
        // Fetch all orders and find the one we need
        const orders = await api.authGet<Order[]>('/admin/orders');
        const found = orders.find(o => o.id === orderId);
        if (found) {
          setOrder(found);
        } else {
          setError('Order not found');
        }
      } catch (err) {
        console.error('Failed to fetch order:', err);
        setError('Failed to load order');
      } finally {
        setLoading(false);
      }
    }

    if (isAdmin) {
      fetchOrder();
    }
  }, [orderId, isAdmin]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyFullAddress = () => {
    if (!order) return;
    const addr = order.shippingAddress;
    const fullAddress = [
      addr.fullName,
      addr.line1,
      addr.line2,
      `${addr.city}, ${addr.state} ${addr.postalCode}`,
      addr.country,
    ]
      .filter(Boolean)
      .join('\n');
    copyToClipboard(fullAddress, 'address');
  };

  const startEditTracking = () => {
    setEditingTracking(true);
    setTrackingCarrier(order?.trackingCarrier || '');
    setTrackingNumber(order?.trackingNumber || '');
  };

  const cancelEditTracking = () => {
    setEditingTracking(false);
    setTrackingCarrier('');
    setTrackingNumber('');
  };

  const saveTracking = async () => {
    if (!order) return;
    setSavingTracking(true);
    try {
      await api.authPatch(`/admin/orders/${order.id}/tracking`, {
        trackingCarrier: trackingCarrier || null,
        trackingNumber: trackingNumber || null,
      });
      setOrder({
        ...order,
        trackingCarrier: trackingCarrier || null,
        trackingNumber: trackingNumber || null,
        status: trackingCarrier && trackingNumber ? 'shipped' : order.status,
      });
      cancelEditTracking();
    } catch (err) {
      console.error('Failed to save tracking:', err);
    } finally {
      setSavingTracking(false);
    }
  };

  const markAsDelivered = async () => {
    if (!order) return;
    setUpdatingStatus(true);
    try {
      await api.authPatch(`/admin/orders/${order.id}/status`, {
        status: 'delivered',
      });
      setOrder({
        ...order,
        status: 'delivered',
      });
    } catch (err) {
      console.error('Failed to mark as delivered:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/admin?tab=orders">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">{error || 'Order not found'}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/admin?tab=orders">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
        </div>

        {/* Order Header Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Package className="h-6 w-6" />
                  Order #{order.id.slice(-8).toUpperCase()}
                </CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => copyToClipboard(order.id, 'orderId')}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 font-mono"
                  >
                    {order.id}
                    {copiedField === 'orderId' ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                    order.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {getStatusDisplay(order.status)}
                </span>
                <span
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                    order.paymentMethod === 'stripe'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {order.paymentMethod === 'stripe' ? 'Stripe' : 'PayPal'}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(order.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Buyer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Buyer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium text-lg">{order.buyerName || 'Guest'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{order.buyerEmail}</p>
                  <button
                    onClick={() => copyToClipboard(order.buyerEmail, 'email')}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy email"
                  >
                    {copiedField === 'email' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <a
                    href={`mailto:${order.buyerEmail}`}
                    className="text-[#df5e15] hover:text-[#c54d0a]"
                    title="Send email"
                  >
                    <Mail className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 mb-4">
                <p className="font-medium">{order.shippingAddress.fullName}</p>
                <p className="text-gray-600">{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && (
                  <p className="text-gray-600">{order.shippingAddress.line2}</p>
                )}
                <p className="text-gray-600">
                  {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                  {order.shippingAddress.postalCode}
                </p>
                <p className="text-gray-600">{order.shippingAddress.country}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyFullAddress}
                className="w-full"
              >
                {copiedField === 'address' ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Full Address
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Tracking Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Tracking Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingTracking ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Carrier
                  </label>
                  <select
                    value={trackingCarrier}
                    onChange={(e) => setTrackingCarrier(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select carrier...</option>
                    <option value="UPS">UPS</option>
                    <option value="USPS">USPS</option>
                    <option value="FedEx">FedEx</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={saveTracking}
                    disabled={savingTracking}
                    className="bg-[#df5e15] hover:bg-[#c54d0a]"
                  >
                    {savingTracking ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Tracking'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelEditTracking}
                    disabled={savingTracking}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : order.trackingCarrier && order.trackingNumber ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">Carrier</p>
                    <p className="font-medium text-lg">{order.trackingCarrier}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Tracking Number</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-medium">{order.trackingNumber}</p>
                      <button
                        onClick={() =>
                          copyToClipboard(order.trackingNumber!, 'tracking')
                        }
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {copiedField === 'tracking' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  {getTrackingUrl(order.trackingCarrier, order.trackingNumber) && (
                    <a
                      href={getTrackingUrl(order.trackingCarrier, order.trackingNumber)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Track Package
                      </Button>
                    </a>
                  )}
                  <Button variant="outline" onClick={startEditTracking}>
                    Edit Tracking
                  </Button>
                  {order.status === 'shipped' && (
                    <Button
                      variant="outline"
                      onClick={markAsDelivered}
                      disabled={updatingStatus}
                      className="border-green-500 text-green-600 hover:bg-green-50"
                    >
                      {updatingStatus ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark as Delivered
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Truck className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 mb-4">No tracking information added yet</p>
                <Button
                  onClick={startEditTracking}
                  className="bg-[#df5e15] hover:bg-[#c54d0a]"
                >
                  Add Tracking
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Order Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-200">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <Link
                        href={`/listing/${item.listingId}`}
                        className="font-medium text-gray-900 hover:text-[#df5e15]"
                      >
                        {item.listingTitle}
                      </Link>
                      <p className="text-sm text-gray-500 mt-1">
                        Quantity: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(item.price, item.currency)}
                      </p>
                      {item.quantity > 1 && (
                        <p className="text-sm text-gray-500">
                          {formatCurrency(item.price * item.quantity, item.currency)} total
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 mt-4 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Total</span>
                <span className="text-2xl font-bold text-[#df5e15]">
                  {formatCurrency(order.totalAmount, order.currency)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
