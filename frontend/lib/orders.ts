/**
 * Shared order vocabulary: how an order's status reads to a human, where a carrier's
 * tracking page lives, and how far along a package is. Used by the customer order
 * pages and the admin one so a status never reads two different ways.
 */

/** The short code a customer quotes in an email, taken from the tail of the id. */
export function orderNumber(orderId: string): string {
  return orderId.slice(-8).toUpperCase();
}

export function getTrackingUrl(carrier: string, trackingNumber: string): string | null {
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

export function getStatusDisplay(status: string): string {
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

export type OrderStage = 'placed' | 'paid' | 'shipped' | 'delivered';

export interface TimelineStep {
  stage: OrderStage;
  label: string;
  /** What the customer should understand has happened, or is about to. */
  detail: string;
  done: boolean;
  /** The step the order is sitting on right now. */
  current: boolean;
}

const STAGE_ORDER: OrderStage[] = ['placed', 'paid', 'shipped', 'delivered'];

/** How far the order has actually got, from the single status the backend stores. */
export function currentStage(status: string): OrderStage {
  switch (status.toLowerCase()) {
    case 'delivered':
      return 'delivered';
    case 'shipped':
      return 'shipped';
    case 'pending':
      return 'placed';
    default:
      // "completed" and "paid" both mean the money is in and we're packing it.
      return 'paid';
  }
}

/**
 * The four steps a purchase moves through, each marked done or not, so the page can
 * draw a progress track without re-deriving the rules.
 */
export function orderTimeline(status: string, hasTracking: boolean): TimelineStep[] {
  const stage = currentStage(status);
  const reached = STAGE_ORDER.indexOf(stage);

  const details: Record<OrderStage, string> = {
    placed: 'We received your order.',
    paid: 'Payment cleared and your guitar is being prepared.',
    shipped: hasTracking
      ? 'On its way — follow the tracking number below.'
      : 'On its way to you.',
    delivered: 'Delivered. Enjoy it.',
  };

  const labels: Record<OrderStage, string> = {
    placed: 'Order placed',
    paid: 'Payment received',
    shipped: 'Shipped',
    delivered: 'Delivered',
  };

  return STAGE_ORDER.map((s, idx) => ({
    stage: s,
    label: labels[s],
    detail: details[s],
    done: idx <= reached,
    current: idx === reached,
  }));
}

export function formatOrderDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatOrderDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Money with cents, since an order total is an exact amount someone was charged. */
export function formatOrderCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}
