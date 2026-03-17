export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// Must be a regular function (not arrow) so `arguments` is available.
// GA4 requires the actual Arguments object, not a plain array.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(..._args: unknown[]) {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  }
}

// Track page views for SPA navigation
export const pageview = (url: string) => {
  if (GA_ID) {
    gtag('event', 'page_view', { page_path: url, page_location: window.location.href });
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
