// Cart utility functions for localStorage-based cart management

export interface CartItem {
  id: string;
  title: string;
  price: number;
  currency: string;
  image: string;
}

const CART_KEY = 'cart';

/**
 * Get cart items from localStorage
 */
export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];

  const cart = localStorage.getItem(CART_KEY);
  if (!cart) return [];

  try {
    return JSON.parse(cart);
  } catch {
    return [];
  }
}

/**
 * Add an item to the cart
 */
export function addToCart(item: CartItem): void {
  const cart = getCart();

  // Check if item already exists in cart
  const existingIndex = cart.findIndex((i) => i.id === item.id);
  if (existingIndex === -1) {
    cart.push(item);
    localStorage.setItem(CART_KEY, JSON.stringify(cart));

    // Dispatch event so components can react to cart updates
    window.dispatchEvent(new Event('cartUpdated'));
  }
}

/**
 * Remove an item from the cart by ID
 */
export function removeFromCart(itemId: string): void {
  const cart = getCart();
  const updatedCart = cart.filter((item) => item.id !== itemId);
  localStorage.setItem(CART_KEY, JSON.stringify(updatedCart));

  // Dispatch event so components can react to cart updates
  window.dispatchEvent(new Event('cartUpdated'));
}

/**
 * Clear all items from the cart
 */
export function clearCart(): void {
  localStorage.removeItem(CART_KEY);

  // Dispatch event so components can react to cart updates
  window.dispatchEvent(new Event('cartUpdated'));
}

/**
 * Get the number of items in the cart
 */
export function getCartCount(): number {
  return getCart().length;
}

/**
 * Calculate the total price of all items in the cart
 */
export function getCartTotal(): { total: number; currency: string } {
  const cart = getCart();

  if (cart.length === 0) {
    return { total: 0, currency: 'USD' };
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const currency = cart[0].currency || 'USD';

  return { total, currency };
}

/**
 * Check if an item is in the cart
 */
export function isInCart(itemId: string): boolean {
  const cart = getCart();
  return cart.some((item) => item.id === itemId);
}
