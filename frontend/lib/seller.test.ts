import { describe, expect, it } from 'vitest';
import { formatMessageTime } from './seller';
import { SELLER_NAV, isNavItemActive, isSellerRoute, isAdminRoute } from './admin-nav';

const tabs = { operations: 'listings', finances: 'transactions', tools: 'snippets' };
const [listings, messages] = SELLER_NAV[0].items;

describe('seller portal navigation', () => {
  it('treats /seller and everything under it as the seller portal, and nothing else', () => {
    expect(isSellerRoute('/seller')).toBe(true);
    expect(isSellerRoute('/seller/messages/abc')).toBe(true);
    expect(isSellerRoute('/sellers')).toBe(false);
    expect(isSellerRoute('/admin')).toBe(false);
    expect(isAdminRoute('/seller')).toBe(false);
  });

  it('highlights Listings only on /seller itself', () => {
    expect(isNavItemActive(listings, '/seller', tabs)).toBe(true);
    expect(isNavItemActive(listings, '/seller/messages', tabs)).toBe(false);
  });

  it('highlights Messages on the inbox and inside a conversation', () => {
    expect(isNavItemActive(messages, '/seller/messages', tabs)).toBe(true);
    expect(isNavItemActive(messages, '/seller/messages/abc', tabs)).toBe(true);
    expect(isNavItemActive(messages, '/seller', tabs)).toBe(false);
  });
});

describe('formatMessageTime', () => {
  const now = new Date(2026, 10, 26, 15, 0);

  it('shows only the time for today', () => {
    expect(formatMessageTime(new Date(2026, 10, 26, 9, 5).toISOString(), now)).toBe('9:05 AM');
  });

  it('adds the weekday within the last few days', () => {
    expect(formatMessageTime(new Date(2026, 10, 24, 9, 5).toISOString(), now)).toBe('Tue 9:05 AM');
  });

  it('shows the date for anything older', () => {
    expect(formatMessageTime(new Date(2026, 10, 4, 9, 5).toISOString(), now)).toBe('Nov 4');
  });
});
