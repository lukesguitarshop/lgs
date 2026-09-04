'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/auth';
import api from '@/lib/api';
import { User, Heart, MessageSquare, Tag, Package, Edit, ChevronRight, Truck, ExternalLink, MapPin, Trash2, Guitar } from 'lucide-react';
import { formatOrderDate, getStatusDisplay, getTrackingUrl, orderNumber } from '@/lib/orders';
import ShippingAddressModal from '@/components/checkout/ShippingAddressModal';
import { ShippingAddress, deleteShippingAddress } from '@/lib/auth';

interface OrderItem {
  listingTitle: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  itemCount: number;
  items: OrderItem[];
  trackingCarrier?: string | null;
  trackingNumber?: string | null;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, isAdmin, setShowLoginModal, refreshUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setShowLoginModal(true);
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router, setShowLoginModal]);

  useEffect(() => {
    async function fetchOrders() {
      if (!isAuthenticated) return;

      try {
        const response = await api.get<Order[]>('/auth/orders', {
          headers: getAuthHeaders(),
        });
        setOrders(response);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
      } finally {
        setOrdersLoading(false);
      }
    }

    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-lg text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleDeleteAddress = async () => {
    setDeleting(true);
    try {
      await deleteShippingAddress();
      await refreshUser();
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete address:', err);
    } finally {
      setDeleting(false);
    }
  };

  const quickLinks = [
    {
      href: '/favorites',
      icon: Heart,
      title: 'Favorites',
      description: 'View your saved listings',
    },
    {
      href: '/messages?filter=offers',
      icon: Tag,
      title: 'Offers',
      description: 'View your offer conversations',
    },
    {
      href: '/messages',
      icon: MessageSquare,
      title: 'Messages',
      description: 'View all conversations',
    },
    {
      href: '/account/trade-ins',
      icon: Guitar,
      title: 'Trade-Ins',
      description: 'Track guitars you sent us',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-heading text-5xl mb-8 text-primary">My Profile</h1>

        {/* User Information */}
        <Card className="mb-6">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-foreground flex items-center justify-center">
                <User className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-2xl">{user.fullName}</CardTitle>
                <p className="text-muted-foreground">{user.email || 'Guest User'}</p>
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <Link href="/profile/edit">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Member since:</span>
                <p className="font-medium">{formatOrderDate(user.createdAt)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Account type:</span>
                <p className="font-medium">{user.isGuest ? 'Guest' : 'Registered'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address - hidden for admin */}
        {!isAdmin && (
          <Card className="mb-6">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Shipping Address
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddressModalOpen(true)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {user.shippingAddress ? 'Edit Address' : 'Add Address'}
                </Button>
                {user.shippingAddress && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Delete confirmation */}
              {showDeleteConfirm && (
                <div className="mb-4 border border-primary/30 bg-primary/8 p-3">
                  <p className="mb-2 text-sm font-medium text-primary">
                    Are you sure you want to delete your shipping address?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDeleteAddress}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting...' : 'Yes, Delete'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {user.shippingAddress ? (
                <div className="text-sm space-y-1">
                  <p className="font-medium">{user.shippingAddress.fullName}</p>
                  <p>{user.shippingAddress.line1}</p>
                  {user.shippingAddress.line2 && <p>{user.shippingAddress.line2}</p>}
                  <p>
                    {user.shippingAddress.city}, {user.shippingAddress.state} {user.shippingAddress.postalCode}
                  </p>
                  <p>{user.shippingAddress.country}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">No shipping address saved. Add one for faster checkout.</p>
              )}
            </CardContent>
          </Card>
        )}

        <ShippingAddressModal
          isOpen={addressModalOpen}
          onClose={() => setAddressModalOpen(false)}
          initialAddress={user.shippingAddress}
          onSave={() => setAddressModalOpen(false)}
        />

        {/* Quick Links - hidden for admin */}
        {!isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Card className="h-full hover:border-foreground transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-foreground/10 flex items-center justify-center">
                      <link.icon className="h-6 w-6 text-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{link.title}</h3>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Order History - hidden for admin */}
        {!isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading orders...
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No orders yet</p>
                  <Link href="/">
                    <Button variant="outline">Browse Guitars</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="group relative border rounded-lg p-4 hover:border-foreground hover:bg-muted/50 transition-colors"
                    >
                      {/* The whole card opens the order. It sits behind the tracking link
                          rather than wrapping it, because anchors cannot nest. */}
                      <Link
                        href={`/account/orders/${order.id}`}
                        aria-label={`View order ${orderNumber(order.id)}`}
                        className="absolute inset-0 rounded-lg"
                      />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div>
                          <p className="font-medium">
                            Order #{orderNumber(order.id)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatOrderDate(order.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">
                            {formatCurrency(order.totalAmount, order.currency)}
                          </p>
                          <span className="label-mono-sm inline-block bg-foreground px-2 py-1 text-background">
                            {getStatusDisplay(order.status)}
                          </span>
                        </div>
                      </div>
                      {/* Tracking Information */}
                      {order.trackingNumber && order.trackingCarrier && (
                        <div className="relative flex items-center gap-2 mb-2 p-2 bg-foreground/10 rounded-md w-fit">
                          <Truck className="h-4 w-4 text-foreground" />
                          <span className="text-sm font-medium text-foreground">
                            {order.trackingCarrier}:
                          </span>
                          {getTrackingUrl(order.trackingCarrier, order.trackingNumber) ? (
                            <a
                              href={getTrackingUrl(order.trackingCarrier, order.trackingNumber)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-foreground hover:underline font-mono inline-flex items-center gap-1"
                            >
                              {order.trackingNumber}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-sm text-foreground font-mono">
                              {order.trackingNumber}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {order.items.slice(0, 2).map((item, idx) => (
                          <p key={idx} className="truncate">
                            {item.quantity}x {item.listingTitle}
                          </p>
                        ))}
                        {order.items.length > 2 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            +{order.items.length - 2} more item{order.items.length - 2 > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      <p className="mt-3 flex items-center gap-1 text-sm font-medium text-primary">
                        View order details
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
