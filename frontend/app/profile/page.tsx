'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/auth';
import api from '@/lib/api';
import { User, Heart, MessageSquare, Tag, Package, Edit, ChevronRight, Truck, ExternalLink } from 'lucide-react';

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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
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

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, isAdmin, setShowLoginModal } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

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
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">My Profile</h1>

        {/* User Information */}
        <Card className="mb-6">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#df5e15] flex items-center justify-center">
                <User className="h-8 w-8 text-white" />
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
                <p className="font-medium">{formatDate(user.createdAt)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Account type:</span>
                <p className="font-medium">{user.isGuest ? 'Guest' : 'Registered'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links - hidden for admin */}
        {!isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Card className="h-full hover:border-[#df5e15] transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                      <link.icon className="h-6 w-6 text-[#df5e15]" />
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
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div>
                          <p className="font-medium">
                            Order #{order.id.slice(-8).toUpperCase()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">
                            {formatCurrency(order.totalAmount, order.currency)}
                          </p>
                          <span className="inline-block px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                            {getStatusDisplay(order.status)}
                          </span>
                        </div>
                      </div>
                      {/* Tracking Information */}
                      {order.trackingNumber && order.trackingCarrier && (
                        <div className="flex items-center gap-2 mb-2 p-2 bg-orange-50 rounded-md">
                          <Truck className="h-4 w-4 text-[#df5e15]" />
                          <span className="text-sm font-medium text-orange-800">
                            {order.trackingCarrier}:
                          </span>
                          {getTrackingUrl(order.trackingCarrier, order.trackingNumber) ? (
                            <a
                              href={getTrackingUrl(order.trackingCarrier, order.trackingNumber)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#df5e15] hover:underline font-mono inline-flex items-center gap-1"
                            >
                              {order.trackingNumber}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-sm text-orange-800 font-mono">
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
