import { describe, it, expect, beforeEach, vi } from 'vitest';

// auth.ts talks to the browser globals directly; vitest runs in the node
// environment here, so stand up minimal Storage implementations first.
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

vi.stubGlobal('window', globalThis);
vi.stubGlobal('localStorage', new MemoryStorage());
vi.stubGlobal('sessionStorage', new MemoryStorage());

const {
  getToken,
  setToken,
  getStoredUser,
  setStoredUser,
  logout,
  startImpersonation,
  endImpersonation,
  isImpersonating,
  isImpersonationExpired,
  getImpersonation,
} = await import('./auth');

const inAnHour = () => new Date(Date.now() + 3600_000).toISOString();
const anHourAgo = () => new Date(Date.now() - 3600_000).toISOString();

const customer = {
  id: 'cust-1',
  email: 'customer@example.com',
  fullName: 'Casey Customer',
  createdAt: '2026-08-01T00:00:00Z',
  isGuest: false,
  isAdmin: false,
  emailVerified: true,
};

const admin = { ...customer, id: 'admin-1', email: 'luke@example.com', fullName: 'Luke', isAdmin: true };

describe('impersonation session storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setToken('admin-token');
    setStoredUser(admin);
  });

  it('reads the admin session when not impersonating', () => {
    expect(isImpersonating()).toBe(false);
    expect(getToken()).toBe('admin-token');
    expect(getStoredUser()?.id).toBe('admin-1');
  });

  it('reads the customer session while impersonating', () => {
    startImpersonation('customer-token', customer, '2026-08-05T12:00:00Z');

    expect(isImpersonating()).toBe(true);
    expect(getToken()).toBe('customer-token');
    expect(getStoredUser()?.id).toBe('cust-1');
    expect(getImpersonation()).toEqual({
      userName: 'Casey Customer',
      userEmail: 'customer@example.com',
      expiresAt: '2026-08-05T12:00:00Z',
    });
  });

  it('leaves the admin session in localStorage untouched', () => {
    startImpersonation('customer-token', customer, '2026-08-05T12:00:00Z');

    expect(localStorage.getItem('auth_token')).toBe('admin-token');
  });

  it('restores the admin session when impersonation ends', () => {
    startImpersonation('customer-token', customer, '2026-08-05T12:00:00Z');
    endImpersonation();

    expect(isImpersonating()).toBe(false);
    expect(getToken()).toBe('admin-token');
    expect(getStoredUser()?.id).toBe('admin-1');
  });

  it('logging out of an impersonated tab only ends the impersonation', () => {
    startImpersonation('customer-token', customer, '2026-08-05T12:00:00Z');
    logout();

    expect(isImpersonating()).toBe(false);
    expect(getToken()).toBe('admin-token');
  });

  it('logging out of a normal tab clears the admin session', () => {
    logout();

    expect(getToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it('reports expiry from the token timestamp, not from API failures', () => {
    expect(isImpersonationExpired()).toBe(false); // not impersonating at all

    startImpersonation('customer-token', customer, inAnHour());
    expect(isImpersonationExpired()).toBe(false);

    startImpersonation('customer-token', customer, anHourAgo());
    expect(isImpersonationExpired()).toBe(true);
  });

  it('treats a missing or unparseable expiry as not expired', () => {
    startImpersonation('customer-token', customer, '');
    expect(isImpersonationExpired()).toBe(false);

    startImpersonation('customer-token', customer, 'not-a-date');
    expect(isImpersonationExpired()).toBe(false);
  });

  it('writes during impersonation do not overwrite the admin session', () => {
    startImpersonation('customer-token', customer, '2026-08-05T12:00:00Z');
    setToken('refreshed-customer-token');

    expect(sessionStorage.getItem('auth_token')).toBe('refreshed-customer-token');
    expect(localStorage.getItem('auth_token')).toBe('admin-token');
  });
});
