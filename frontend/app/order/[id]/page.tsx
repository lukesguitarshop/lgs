'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { Input } from '@/components/ui/input';
import { StateBlock } from '@/components/ui/state-block';
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
  FileDown,
  Handshake,
  Pencil,
  Phone,
  StickyNote,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  buyerDisplayName,
  formatOrderCurrency as formatCurrency,
  getStatusDisplay,
  getTrackingUrl,
  isHandedOver,
  isInPersonOrder,
  orderNumber,
  paymentLabel,
} from '@/lib/orders';

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
  orderType?: string;
  /** "web" or "in_person". */
  source?: string;
  /** "ship" or "handed_over". */
  fulfillment?: string;
  needsDetails?: boolean;
  hasAccount?: boolean;
  buyerPhone?: string | null;
  adminNotes?: string | null;
  deliveredAt?: string | null;
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

function generateOrderPdf(order: Order): void {
  // Letter size, points. High-res by default (jsPDF text is vector = crisp).
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;
  const brand: [number, number, number] = [110, 1, 20]; // #6E0114
  const ink: [number, number, number] = [2, 14, 28]; // #020E1C
  const muted: [number, number, number] = [120, 120, 120];
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setTextColor(...brand);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text("Luke's Guitar Shop", margin, y);

  doc.setTextColor(...ink);
  doc.setFontSize(16);
  doc.text(`Order #${orderNumber(order.id)}`, pageWidth - margin, y, {
    align: 'right',
  });
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(order.id, pageWidth - margin, y, { align: 'right' });
  y += 16;

  // Divider
  doc.setDrawColor(...brand);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  // Section helper
  const sectionTitle = (title: string) => {
    ensureSpace(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...brand);
    doc.text(title, margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...ink);
  };

  const field = (label: string, value: string) => {
    ensureSpace(28);
    doc.setTextColor(...muted);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), margin, y);
    y += 12;
    doc.setTextColor(...ink);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(value || '—', contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 13 + 6;
  };

  // Order summary
  sectionTitle('Order Summary');
  field('Status', getStatusDisplay(order.status));
  field('Payment Method', isInPersonOrder(order) ? 'In person (Stripe)' : paymentLabel(order));
  field('Order Date', formatDate(order.createdAt));
  y += 6;

  // Buyer information
  sectionTitle('Buyer Information');
  field('Name', buyerDisplayName(order.buyerName, order));
  field('Email', order.buyerEmail || '—');
  if (order.buyerPhone) field('Phone', order.buyerPhone);
  if (order.adminNotes) field('Notes', order.adminNotes);
  y += 6;

  // Shipping address
  const addr = order.shippingAddress;
  const addressLines = [
    addr.fullName,
    addr.line1,
    addr.line2,
    `${addr.city}, ${addr.state} ${addr.postalCode}`,
    addr.country,
  ]
    .filter(Boolean)
    .join('\n');
  if (isHandedOver(order)) {
    sectionTitle('Delivery');
    field('Handed over in person', formatDate(order.deliveredAt || order.createdAt));
    y += 6;
  } else {
    sectionTitle('Shipping Address');
    field('Ship To', addressLines);
    y += 6;

    // Tracking
    sectionTitle('Tracking Information');
    if (order.trackingCarrier && order.trackingNumber) {
      field('Carrier', order.trackingCarrier);
      field('Tracking Number', order.trackingNumber);
    } else {
      field('Status', 'No tracking information added yet');
    }
    y += 6;
  }

  // Order items
  sectionTitle('Order Items');
  // Table header
  ensureSpace(28);
  const priceX = pageWidth - margin;
  const qtyX = pageWidth - margin - 110;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text('ITEM', margin, y);
  doc.text('QTY', qtyX, y, { align: 'right' });
  doc.text('TOTAL', priceX, y, { align: 'right' });
  y += 8;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.75);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  order.items.forEach((item) => {
    const titleLines = doc.splitTextToSize(item.listingTitle, contentWidth - 160);
    const rowHeight = titleLines.length * 13 + 8;
    ensureSpace(rowHeight);
    const rowTop = y;
    doc.text(titleLines, margin, rowTop);
    doc.text(String(item.quantity), qtyX, rowTop, { align: 'right' });
    doc.text(
      formatCurrency(item.price * item.quantity, item.currency),
      priceX,
      rowTop,
      { align: 'right' }
    );
    y = rowTop + rowHeight;
  });

  // Total
  ensureSpace(40);
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.75);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...ink);
  doc.text('Total', margin, y);
  doc.setTextColor(...brand);
  doc.setFontSize(15);
  doc.text(
    formatCurrency(order.totalAmount, order.currency),
    priceX,
    y,
    { align: 'right' }
  );

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(
    `Generated ${new Date().toLocaleString('en-US')} · lukesguitarshop.com`,
    margin,
    pageHeight - margin / 2
  );

  doc.save(`order-${orderNumber(order.id)}.pdf`);
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const orderId = params.id as string;

  // Determine back URL based on where user came from
  const fromUserId = searchParams.get('fromUser');
  const backUrl = fromUserId ? `/admin/user/${fromUserId}` : '/admin?tab=orders';
  const backLabel = fromUserId ? 'Back to User' : 'Back to Orders';

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

  // Buyer details (account-less orders only: guest checkout, in-person sales)
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({ buyerName: '', buyerEmail: '', buyerPhone: '', adminNotes: '' });
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

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
          if (found.needsDetails) {
            setDetailsForm({
              buyerName: found.buyerName || '',
              buyerEmail: found.buyerEmail || '',
              buyerPhone: found.buyerPhone || '',
              adminNotes: found.adminNotes || '',
            });
            setEditingDetails(true);
          }
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

  const startEditDetails = () => {
    if (!order) return;
    setDetailsForm({
      buyerName: order.buyerName || '',
      buyerEmail: order.buyerEmail || '',
      buyerPhone: order.buyerPhone || '',
      adminNotes: order.adminNotes || '',
    });
    setDetailsError(null);
    setEditingDetails(true);
  };

  const saveDetails = async () => {
    if (!order) return;
    setSavingDetails(true);
    setDetailsError(null);
    try {
      await api.authPatch(`/admin/orders/${order.id}/details`, {
        buyerName: order.hasAccount ? null : detailsForm.buyerName.trim() || null,
        buyerEmail: order.hasAccount ? null : detailsForm.buyerEmail.trim() || null,
        buyerPhone: order.hasAccount ? null : detailsForm.buyerPhone.trim() || null,
        adminNotes: detailsForm.adminNotes,
      });
      setOrder({
        ...order,
        buyerName: order.hasAccount ? order.buyerName : detailsForm.buyerName.trim() || order.buyerName,
        buyerEmail: order.hasAccount ? order.buyerEmail : detailsForm.buyerEmail.trim() || order.buyerEmail,
        buyerPhone: order.hasAccount ? order.buyerPhone : detailsForm.buyerPhone.trim() || null,
        adminNotes: detailsForm.adminNotes.trim() || null,
        needsDetails: false,
      });
      setEditingDetails(false);
      showToast('Buyer details saved', 'success', 2500);
    } catch (err) {
      setDetailsError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Could not save the details.'
      );
    } finally {
      setSavingDetails(false);
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
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          <Link href={backUrl}>
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {backLabel}
            </Button>
          </Link>
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/60 mb-4" />
              <p className="text-foreground/60">{error || 'Order not found'}</p>
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link href={backUrl}>
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {backLabel}
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => generateOrderPdf(order)}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export as PDF
          </Button>
        </div>

        {/* Order Header Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Package className="h-6 w-6" />
                  Order #{orderNumber(order.id)}
                </CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => copyToClipboard(order.id, 'orderId')}
                    className="text-sm text-foreground/60 hover:text-foreground/78 flex items-center gap-1 font-mono"
                  >
                    {order.id}
                    {copiedField === 'orderId' ? (
                      <Check className="h-3 w-3 text-primary" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span
                  className={`inline-flex items-center whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium ${
                    order.status === 'pending'
                      ? 'bg-muted-foreground text-foreground'
                      : 'bg-foreground text-background'
                  }`}
                >
                  {getStatusDisplay(order.status)}
                </span>
                <span
                  className={`inline-flex items-center whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium ${
                    isInPersonOrder(order) ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground/78'
                  }`}
                >
                  {isInPersonOrder(order) ? 'In person · Stripe' : paymentLabel(order)}
                </span>
                {order.needsDetails && (
                  <span className="inline-flex items-center whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                    Needs details
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-foreground/70">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(order.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        {order.needsDetails && (
          <StateBlock variant="warning" label={isInPersonOrder(order) ? 'In-person sale' : 'Guest order'} className="mb-6">
            {isInPersonOrder(order)
              ? 'This guitar was sold in person. Stripe captured what it could about the buyer; fill in the rest below and save to clear this flag.'
              : 'This order has no account behind it. Confirm the buyer details below and save to clear this flag.'}
          </StateBlock>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Buyer Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Buyer Information
                </CardTitle>
                {!editingDetails && (
                  <Button variant="outline" size="sm" onClick={startEditDetails}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    {order.hasAccount ? 'Notes' : 'Edit'}
                  </Button>
                )}
              </div>
            </CardHeader>
            {editingDetails ? (
              <CardContent className="space-y-4">
                {!order.hasAccount && (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground/78" htmlFor="buyer-name">Name</label>
                      <Input
                        id="buyer-name"
                        value={detailsForm.buyerName}
                        onChange={(e) => setDetailsForm({ ...detailsForm, buyerName: e.target.value })}
                        placeholder="Who bought it"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground/78" htmlFor="buyer-email">Email</label>
                      <Input
                        id="buyer-email"
                        type="email"
                        inputMode="email"
                        value={detailsForm.buyerEmail}
                        onChange={(e) => setDetailsForm({ ...detailsForm, buyerEmail: e.target.value })}
                        placeholder="For the receipt and any tracking email"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground/78" htmlFor="buyer-phone">Phone</label>
                      <Input
                        id="buyer-phone"
                        type="tel"
                        inputMode="tel"
                        value={detailsForm.buyerPhone}
                        onChange={(e) => setDetailsForm({ ...detailsForm, buyerPhone: e.target.value })}
                        placeholder="Optional"
                        autoComplete="off"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground/78" htmlFor="admin-notes">Notes</label>
                  <textarea
                    id="admin-notes"
                    value={detailsForm.adminNotes}
                    onChange={(e) => setDetailsForm({ ...detailsForm, adminNotes: e.target.value })}
                    rows={3}
                    placeholder="Anything worth remembering about this sale"
                    className="w-full border border-foreground/35 bg-transparent px-3.5 py-2.5 text-base placeholder:text-foreground/45 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:border-input md:px-3 md:text-sm"
                  />
                </div>
                {detailsError && (
                  <StateBlock variant="error">{detailsError}</StateBlock>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={saveDetails}
                    disabled={savingDetails}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {savingDetails ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Details'
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingDetails(false)} disabled={savingDetails}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            ) : (
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-foreground/60">Name</p>
                <p className="font-medium text-lg">{buyerDisplayName(order.buyerName, order)}</p>
              </div>
              <div>
                <p className="text-sm text-foreground/60">Email</p>
                {order.buyerEmail ? (
                <div className="flex items-center gap-2">
                  <p className="font-medium">{order.buyerEmail}</p>
                  <button
                    onClick={() => copyToClipboard(order.buyerEmail, 'email')}
                    className="text-muted-foreground hover:text-foreground/70"
                    title="Copy email"
                  >
                    {copiedField === 'email' ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <a
                    href={`mailto:${order.buyerEmail}`}
                    className="text-primary hover:text-primary/90"
                    title="Send email"
                  >
                    <Mail className="h-4 w-4" />
                  </a>
                </div>
                ) : (
                  <p className="italic text-foreground/50">Not recorded</p>
                )}
              </div>
              {(order.buyerPhone || !order.hasAccount) && (
                <div>
                  <p className="text-sm text-foreground/60">Phone</p>
                  {order.buyerPhone ? (
                    <a href={`tel:${order.buyerPhone}`} className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary">
                      <Phone className="h-4 w-4 text-foreground/50" />
                      {order.buyerPhone}
                    </a>
                  ) : (
                    <p className="italic text-foreground/50">Not recorded</p>
                  )}
                </div>
              )}
              {order.adminNotes && (
                <div>
                  <p className="text-sm text-foreground/60 flex items-center gap-1.5">
                    <StickyNote className="h-3.5 w-3.5" />
                    Notes
                  </p>
                  <p className="whitespace-pre-wrap text-[15px] leading-[1.5]">{order.adminNotes}</p>
                </div>
              )}
            </CardContent>
            )}
          </Card>

          {/* Shipping Address / in-person hand-over */}
          {isHandedOver(order) ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Handshake className="h-5 w-5" />
                Delivery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-lg">Handed over in person</p>
              <p className="text-foreground/70 mt-1">
                The buyer left with the guitar on {formatDate(order.deliveredAt || order.createdAt)}. Nothing ships and there is no tracking.
              </p>
            </CardContent>
          </Card>
          ) : (
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
                <p className="text-foreground/70">{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && (
                  <p className="text-foreground/70">{order.shippingAddress.line2}</p>
                )}
                <p className="text-foreground/70">
                  {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                  {order.shippingAddress.postalCode}
                </p>
                <p className="text-foreground/70">{order.shippingAddress.country}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyFullAddress}
                className="w-full"
              >
                {copiedField === 'address' ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-primary" />
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
          )}
        </div>

        {/* Tracking Information — not for a guitar that left with the buyer */}
        {!isHandedOver(order) && (
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
                  <label className="block text-sm font-medium text-foreground/78 mb-1">
                    Carrier
                  </label>
                  <select
                    value={trackingCarrier}
                    onChange={(e) => setTrackingCarrier(e.target.value)}
                    className="w-full border border-foreground/25 rounded-md px-3 py-2"
                  >
                    <option value="">Select carrier...</option>
                    <option value="UPS">UPS</option>
                    <option value="USPS">USPS</option>
                    <option value="FedEx">FedEx</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/78 mb-1">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number"
                    className="w-full border border-foreground/25 rounded-md px-3 py-2"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={saveTracking}
                    disabled={savingTracking}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                <div className="flex items-center justify-between border border-foreground/15 bg-muted/50 p-4">
                  <div>
                    <p className="text-sm text-foreground/60">Carrier</p>
                    <p className="font-medium text-lg">{order.trackingCarrier}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-foreground/60">Tracking Number</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-medium">{order.trackingNumber}</p>
                      <button
                        onClick={() =>
                          copyToClipboard(order.trackingNumber!, 'tracking')
                        }
                        className="text-muted-foreground hover:text-foreground/70"
                      >
                        {copiedField === 'tracking' ? (
                          <Check className="h-4 w-4 text-primary" />
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
                      className="border-foreground text-foreground hover:bg-foreground hover:text-background"
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
                <Truck className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" />
                <p className="text-foreground/60 mb-4">No tracking information added yet</p>
                <Button
                  onClick={startEditTracking}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Add Tracking
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        )}

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
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {item.listingTitle}
                      </Link>
                      <p className="text-sm text-foreground/60 mt-1">
                        Quantity: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(item.price, item.currency)}
                      </p>
                      {item.quantity > 1 && (
                        <p className="text-sm text-foreground/60">
                          {formatCurrency(item.price * item.quantity, item.currency)} total
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-foreground/15 mt-4 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Total</span>
                <span className="text-2xl font-bold text-primary">
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
