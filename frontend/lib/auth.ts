// Auth utility functions for managing user authentication

import api from './api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const IMPERSONATION_KEY = 'impersonation';

export interface ImpersonationInfo {
  userName: string;
  userEmail: string | null;
  expiresAt: string;
}

/**
 * Impersonation sessions live in sessionStorage so they are scoped to a single tab:
 * the admin's own session in localStorage keeps working in every other tab.
 * All token/user reads and writes go through the active store so the rest of the
 * app never has to know which kind of session it is in.
 */
function activeStore(): Storage | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(IMPERSONATION_KEY) ? sessionStorage : localStorage;
}

/**
 * Details of the customer being impersonated in this tab, or null for a normal session
 */
export function getImpersonation(): ImpersonationInfo | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(IMPERSONATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Check whether this tab is impersonating a customer
 */
export function isImpersonating(): boolean {
  return getImpersonation() !== null;
}

/**
 * Start impersonating a customer in this tab only
 */
export function startImpersonation(token: string, user: User, expiresAt: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    IMPERSONATION_KEY,
    JSON.stringify({ userName: user.fullName, userEmail: user.email, expiresAt })
  );
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * End impersonation in this tab, leaving the admin's own session untouched
 */
export function endImpersonation(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(IMPERSONATION_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export interface ShippingAddress {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface User {
  id: string;
  email: string | null;
  fullName: string;
  createdAt: string;
  isGuest: boolean;
  shippingAddress?: ShippingAddress | null;
  isAdmin: boolean;
  emailVerified: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterResponse {
  token?: string;
  user?: User;
  message?: string;
}


/**
 * Get the stored JWT token
 */
export function getToken(): string | null {
  return activeStore()?.getItem(TOKEN_KEY) ?? null;
}

/**
 * Store the JWT token
 */
export function setToken(token: string): void {
  activeStore()?.setItem(TOKEN_KEY, token);
}

/**
 * Remove the JWT token
 */
export function removeToken(): void {
  activeStore()?.removeItem(TOKEN_KEY);
}

/**
 * Get the stored user
 */
export function getStoredUser(): User | null {
  const userJson = activeStore()?.getItem(USER_KEY);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

/**
 * Store the user
 */
export function setStoredUser(user: User): void {
  activeStore()?.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Remove the stored user
 */
export function removeStoredUser(): void {
  activeStore()?.removeItem(USER_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Get authorization headers for API requests
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Register a new user
 * Note: Registration now requires email verification before login
 * This function returns a message, not a token
 */
export async function register(
  email: string,
  password: string,
  fullName: string
): Promise<RegisterResponse> {
  const response = await api.post<RegisterResponse>('/auth/register', {
    email,
    password,
    fullName,
  });

  // If token is returned (shouldn't happen with new flow, but handle for compatibility)
  if (response.token && response.user) {
    setToken(response.token);
    setStoredUser(response.user);
  }

  return response;
}

/**
 * Login with email and password
 */
export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', {
    email,
    password,
  });

  setToken(response.token);
  setStoredUser(response.user);

  return response;
}

/**
 * Logout - clear all auth data
 */
export function logout(): void {
  // Inside an impersonated tab this only ends the impersonation; the admin's
  // own session in localStorage is left alone.
  if (isImpersonating()) {
    endImpersonation();
    return;
  }
  removeToken();
  removeStoredUser();
}

/**
 * Get current user profile from API
 */
export async function getCurrentUser(): Promise<User> {
  const response = await api.get<User>('/auth/me', {
    headers: getAuthHeaders(),
  });

  setStoredUser(response);
  return response;
}

/**
 * Update user profile
 */
export async function updateProfile(data: {
  fullName?: string;
  email?: string;
  shippingAddress?: ShippingAddress;
}): Promise<User> {
  const response = await api.put<User>('/auth/profile', data, {
    headers: getAuthHeaders(),
  });

  setStoredUser(response);
  return response;
}

/**
 * Save shipping address to user profile
 */
export async function saveShippingAddress(address: ShippingAddress): Promise<User> {
  return updateProfile({ shippingAddress: address });
}

/**
 * Delete shipping address from user profile
 */
export async function deleteShippingAddress(): Promise<User> {
  const response = await api.put<User>('/auth/profile', { removeShippingAddress: true }, {
    headers: getAuthHeaders(),
  });

  setStoredUser(response);
  return response;
}

/**
 * Request password reset email
 */
export async function forgotPassword(email: string): Promise<{ message: string }> {
  return api.post<{ message: string }>('/auth/forgot-password', { email });
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return api.post<{ message: string }>('/auth/reset-password', { token, newPassword });
}

/**
 * Verify email with token
 */
export async function verifyEmail(token: string): Promise<{ message: string }> {
  return api.post<{ message: string }>('/auth/verify-email', { token });
}

/**
 * Resend verification email
 */
export async function resendVerification(email: string): Promise<{ message: string }> {
  return api.post<{ message: string }>('/auth/resend-verification', { email });
}
