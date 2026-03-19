'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Loader2,
  User,
  Mail,
  ShieldCheck,
  UserX,
  Calendar,
  MapPin,
  Package,
  Receipt,
  Pencil,
  Check,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  ShieldX,
} from 'lucide-react';

interface UserDetail {
  id: string;
  email: string | null;
  fullName: string;
  isAdmin: boolean;
  isGuest: boolean;
  emailVerified: boolean;
  createdAt: string;
  guestSessionId: string | null;
  shippingAddress: {
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
}

interface OrderItem {
  listingId: string;
  listingTitle: string;
  price: number;
  currency: string;
  quantity: number;
}

interface UserOrder {
  id: string;
  paymentMethod: string;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  trackingCarrier: string | null;
  trackingNumber: string | null;
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { isAdmin, isLoading: authLoading, isAuthenticated, setShowLoginModal } = useAuth();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editEmailVerified, setEditEmailVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  // Shipping address edit state
  const [editShippingFullName, setEditShippingFullName] = useState('');
  const [editShippingLine1, setEditShippingLine1] = useState('');
  const [editShippingLine2, setEditShippingLine2] = useState('');
  const [editShippingCity, setEditShippingCity] = useState('');
  const [editShippingState, setEditShippingState] = useState('');
  const [editShippingPostalCode, setEditShippingPostalCode] = useState('');
  const [editShippingCountry, setEditShippingCountry] = useState('');

  // Order expansion
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Copy state
  const [copiedAddress, setCopiedAddress] = useState(false);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.authGet<UserDetail>(`/admin/users/${userId}`);
      setUser(data);
      setEditFullName(data.fullName);
      setEditEmail(data.email || '');
      setEditIsAdmin(data.isAdmin);
      setEditEmailVerified(data.emailVerified);
      // Set shipping address edit state
      if (data.shippingAddress) {
        setEditShippingFullName(data.shippingAddress.fullName || '');
        setEditShippingLine1(data.shippingAddress.line1 || '');
        setEditShippingLine2(data.shippingAddress.line2 || '');
        setEditShippingCity(data.shippingAddress.city || '');
        setEditShippingState(data.shippingAddress.state || '');
        setEditShippingPostalCode(data.shippingAddress.postalCode || '');
        setEditShippingCountry(data.shippingAddress.country || '');
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const data = await api.authGet<UserOrder[]>(`/admin/users/${userId}/orders`);
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isAdmin && userId) {
      fetchUser();
      fetchOrders();
    }
  }, [isAdmin, userId, fetchUser, fetchOrders]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Build shipping address object if any field is filled
      const hasShippingAddress = editShippingLine1 || editShippingCity;
      const shippingAddress = hasShippingAddress ? {
        fullName: editShippingFullName || editFullName,
        line1: editShippingLine1,
        line2: editShippingLine2 || null,
        city: editShippingCity,
        state: editShippingState,
        postalCode: editShippingPostalCode,
        country: editShippingCountry || 'US',
      } : null;

      const updated = await api.authPut<UserDetail>(`/admin/users/${userId}`, {
        fullName: editFullName,
        email: editEmail || null,
        isAdmin: editIsAdmin,
        emailVerified: editEmailVerified,
        shippingAddress,
      });
      setUser(updated);
      setEditing(false);
    } catch (err) {
      console.error('Failed to update user:', err);
      alert(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (user) {
      setEditFullName(user.fullName);
      setEditEmail(user.email || '');
      setEditIsAdmin(user.isAdmin);
      setEditEmailVerified(user.emailVerified);
      // Reset shipping address
      if (user.shippingAddress) {
        setEditShippingFullName(user.shippingAddress.fullName || '');
        setEditShippingLine1(user.shippingAddress.line1 || '');
        setEditShippingLine2(user.shippingAddress.line2 || '');
        setEditShippingCity(user.shippingAddress.city || '');
        setEditShippingState(user.shippingAddress.state || '');
        setEditShippingPostalCode(user.shippingAddress.postalCode || '');
        setEditShippingCountry(user.shippingAddress.country || '');
      } else {
        setEditShippingFullName('');
        setEditShippingLine1('');
        setEditShippingLine2('');
        setEditShippingCity('');
        setEditShippingState('');
        setEditShippingPostalCode('');
        setEditShippingCountry('');
      }
    }
    setEditing(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyFullAddress = () => {
    if (!user?.shippingAddress) return;
    const addr = user.shippingAddress;
    const fullAddress = [
      addr.fullName,
      addr.line1,
      addr.line2,
      `${addr.city}, ${addr.state} ${addr.postalCode}`,
      addr.country,
    ]
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(fullAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const formatDate = (dateString: string) => {
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

  if (authLoading) {
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
              ? "You don't have permission to access this page."
              : 'Please sign in with an admin account to access this page.'}
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
              <Button variant="outline" className="w-full py-3">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center text-gray-600 hover:text-[#020E1C] transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Portal
          </Link>
        </div>
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center text-gray-600 hover:text-[#020E1C] transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Portal
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700">{error || 'User not found'}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/admin')}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
      {/* Back Link */}
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center text-gray-600 hover:text-[#020E1C] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin Portal
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#020E1C]">{user.fullName}</h1>
          <p className="text-gray-600">
            {user.email || (user.isGuest ? `Guest (${user.guestSessionId?.slice(0, 8)}...)` : 'No email')}
          </p>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <Button onClick={() => setEditing(true)} className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]">
              <Pencil className="h-4 w-4 mr-2" />
              Edit User
            </Button>
          ) : (
            <>
              <Button onClick={handleCancelEdit} variant="outline" disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Info Card */}
        <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-[#020E1C] flex items-center gap-2 mb-4">
            <User className="h-5 w-5" />
            User Information
          </h2>

          <div className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Full Name</label>
              {editing ? (
                <Input
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Full name"
                />
              ) : (
                <p className="text-[#020E1C]">{user.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
              {editing ? (
                <Input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email address"
                  type="email"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <p className="text-[#020E1C]">{user.email || <span className="italic text-gray-500">No email</span>}</p>
                </div>
              )}
            </div>

            {/* User ID */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">User ID</label>
              <div className="flex items-center gap-2">
                <code className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded">{user.id}</code>
                <button onClick={() => copyToClipboard(user.id)} className="text-gray-400 hover:text-gray-600">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Created */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Created</label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <p className="text-[#020E1C]">{formatDate(user.createdAt)}</p>
              </div>
            </div>

            {/* Status Badges */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Status</label>
              {editing ? (
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editIsAdmin}
                      onChange={(e) => setEditIsAdmin(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Admin</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editEmailVerified}
                      onChange={(e) => setEditEmailVerified(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Email Verified</span>
                  </label>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {user.isAdmin && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                      <ShieldCheck className="h-4 w-4" />
                      Admin
                    </span>
                  )}
                  {user.isGuest && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                      <UserX className="h-4 w-4" />
                      Guest
                    </span>
                  )}
                  {!user.isGuest && user.emailVerified && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      <Mail className="h-4 w-4" />
                      Email Verified
                    </span>
                  )}
                  {!user.isGuest && !user.emailVerified && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                      <Mail className="h-4 w-4" />
                      Email Unverified
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Shipping Address Card */}
        <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-[#020E1C] flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5" />
            Shipping Address
          </h2>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Full Name</label>
                <Input
                  value={editShippingFullName}
                  onChange={(e) => setEditShippingFullName(e.target.value)}
                  placeholder="Full name for shipping"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Address Line 1</label>
                <Input
                  value={editShippingLine1}
                  onChange={(e) => setEditShippingLine1(e.target.value)}
                  placeholder="Street address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Address Line 2</label>
                <Input
                  value={editShippingLine2}
                  onChange={(e) => setEditShippingLine2(e.target.value)}
                  placeholder="Apt, suite, unit (optional)"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">City</label>
                  <Input
                    value={editShippingCity}
                    onChange={(e) => setEditShippingCity(e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">State</label>
                  <Input
                    value={editShippingState}
                    onChange={(e) => setEditShippingState(e.target.value)}
                    placeholder="State"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Postal Code</label>
                  <Input
                    value={editShippingPostalCode}
                    onChange={(e) => setEditShippingPostalCode(e.target.value)}
                    placeholder="ZIP / Postal code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Country</label>
                  <Input
                    value={editShippingCountry}
                    onChange={(e) => setEditShippingCountry(e.target.value)}
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>
          ) : user.shippingAddress ? (
            <div>
              <div className="text-[#020E1C] mb-4">
                <p className="font-medium">{user.shippingAddress.fullName}</p>
                <p>{user.shippingAddress.line1}</p>
                {user.shippingAddress.line2 && <p>{user.shippingAddress.line2}</p>}
                <p>
                  {user.shippingAddress.city}, {user.shippingAddress.state} {user.shippingAddress.postalCode}
                </p>
                <p>{user.shippingAddress.country}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyFullAddress}
                className="w-full"
              >
                {copiedAddress ? (
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
            </div>
          ) : (
            <p className="text-gray-500 italic">No shipping address saved</p>
          )}
        </div>
      </div>

      {/* Orders Section */}
      <div className="mt-6 bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-[#020E1C] flex items-center gap-2 mb-4">
          <Receipt className="h-5 w-5" />
          Order History
          <span className="text-sm font-normal text-gray-500">({orders.length} orders)</span>
        </h2>

        {loadingOrders ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No orders yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-700">Order ID</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-700">Date</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-700">Items</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-700">Total</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-700">Payment</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-700">Tracking</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/order/${order.id}?fromUser=${userId}`}
                          className="font-mono text-xs text-[#6E0114] hover:underline"
                        >
                          {order.id.substring(0, 8)}...
                        </Link>
                        <button
                          onClick={() => copyToClipboard(order.id)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-gray-600 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                    <td className="py-3 px-2">
                      <button
                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-[#020E1C]"
                      >
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        {expandedOrderId === order.id ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                      {expandedOrderId === order.id && (
                        <div className="mt-2 space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="text-xs text-gray-600">
                              <span className="font-medium">{item.listingTitle}</span>
                              <span className="text-gray-400 ml-1">
                                ({item.quantity}x ${item.price.toLocaleString()})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2 font-semibold text-[#020E1C]">
                      ${order.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          order.paymentMethod === 'stripe'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {order.paymentMethod === 'stripe' ? 'Stripe' : 'PayPal'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {getStatusDisplay(order.status)}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {order.trackingCarrier && order.trackingNumber ? (
                        <div>
                          <p className="text-xs font-medium text-[#020E1C]">{order.trackingCarrier}</p>
                          <p className="text-xs text-gray-600 font-mono">{order.trackingNumber}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No tracking</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
