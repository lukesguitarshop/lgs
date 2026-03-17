export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// Helper to safely push to dataLayer (works with @next/third-parties)
const gtag = (...args: unknown[]) => {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(args);
  }
};

// Track page views for SPA navigation
export const pageview = (url: string) => {
  if (GA_ID) {
    gtag('config', GA_ID, { page_path: url });
  }
};

// Track custom events
export const event = (action: string, params?: Record<string, unknown>) => {
  gtag('event', action, params);
};

// Specific tracking functions
export const trackLogin = (method: string = 'email') => {
  event('login', { method });
};

export const trackSignUp = (method: string = 'email') => {
  event('sign_up', { method });
};

export const trackAddToCart = (item: {
  id: string;
  name: string;
  price: number;
  currency?: string;
}) => {
  event('add_to_cart', {
    currency: item.currency || 'USD',
    value: item.price,
    items: [{ item_id: item.id, item_name: item.name, price: item.price }],
  });
};

export const trackRemoveFromCart = (item: {
  id: string;
  name: string;
  price: number;
}) => {
  event('remove_from_cart', {
    currency: 'USD',
    value: item.price,
    items: [{ item_id: item.id, item_name: item.name, price: item.price }],
  });
};

export const trackViewItem = (item: {
  id: string;
  name: string;
  price: number;
  currency?: string;
}) => {
  event('view_item', {
    currency: item.currency || 'USD',
    value: item.price,
    items: [{ item_id: item.id, item_name: item.name, price: item.price }],
  });
};

export const trackBeginCheckout = (value: number, currency: string = 'USD') => {
  event('begin_checkout', { currency, value });
};

export const trackPurchase = (orderId: string, value: number, currency: string = 'USD') => {
  event('purchase', { transaction_id: orderId, currency, value });
};
