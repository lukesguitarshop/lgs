// Auth utility functions for managing user authentication

import api from './api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

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
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store the JWT token
 */
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove the JWT token
 */
export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Get the stored user
 */
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userJson = localStorage.getItem(USER_KEY);
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
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Remove the stored user
 */
export function removeStoredUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
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
