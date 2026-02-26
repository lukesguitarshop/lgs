// API client utility for communicating with the .NET backend

import { getToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

export interface ApiError {
  message: string;
  status?: number;
}

/**
 * Get auth headers if token exists
 */
function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      // Try to get error message from response body
      let errorMessage = `API request failed: ${response.statusText}`;
      try {
        const errorBody = await response.json();
        if (errorBody.errors) {
          // ASP.NET validation errors
          errorMessage = `Validation errors: ${JSON.stringify(errorBody.errors)}`;
        } else if (errorBody.error) {
          errorMessage = errorBody.error;
        } else if (errorBody.message) {
          errorMessage = errorBody.message;
        } else if (errorBody.title) {
          errorMessage = errorBody.title;
        }
      } catch {
        // Response body is not JSON, use default message
      }
      const error: ApiError = {
        message: errorMessage,
        status: response.status,
      };
      throw error;
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw {
        message: error.message,
      } as ApiError;
    }
    throw error;
  }
}

/**
 * API client methods
 */
export const api = {
  // GET request
  get: <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    return fetchApi<T>(endpoint, { ...options, method: 'GET' });
  },

  // POST request
  post: <T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> => {
    return fetchApi<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  // PUT request
  put: <T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> => {
    return fetchApi<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  // DELETE request
  delete: <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    return fetchApi<T>(endpoint, { ...options, method: 'DELETE' });
  },

  // PATCH request
  patch: <T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> => {
    return fetchApi<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  // Authenticated GET request (includes JWT token if available)
  authGet: <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    return fetchApi<T>(endpoint, {
      ...options,
      method: 'GET',
      headers: { ...getAuthHeaders(), ...options?.headers },
    });
  },

  // Authenticated POST request (includes JWT token if available)
  authPost: <T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> => {
    return fetchApi<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: { ...getAuthHeaders(), ...options?.headers },
    });
  },

  // Authenticated PUT request (includes JWT token if available)
  authPut: <T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> => {
    return fetchApi<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: { ...getAuthHeaders(), ...options?.headers },
    });
  },

  // Authenticated PATCH request (includes JWT token if available)
  authPatch: <T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> => {
    return fetchApi<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      headers: { ...getAuthHeaders(), ...options?.headers },
    });
  },

  // Authenticated DELETE request (includes JWT token if available)
  authDelete: <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    return fetchApi<T>(endpoint, {
      ...options,
      method: 'DELETE',
      headers: { ...getAuthHeaders(), ...options?.headers },
    });
  },
};

// Deal Finder API
import type { PotentialBuy, PotentialBuyStats, PaginatedPotentialBuys } from './types/potential-buy';

export async function getPotentialBuys(
  status?: string,
  sort?: string,
  page = 1,
  perPage = 20
): Promise<PaginatedPotentialBuys> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (sort) params.set('sort', sort);
  params.set('page', String(page));
  params.set('perPage', String(perPage));

  return api.authGet<PaginatedPotentialBuys>(`/admin/potential-buys?${params}`);
}

export async function getPotentialBuyStats(): Promise<PotentialBuyStats> {
  return api.authGet<PotentialBuyStats>('/admin/potential-buys/stats');
}

export async function dismissPotentialBuy(id: string): Promise<{ message: string }> {
  return api.authPatch<{ message: string }>(`/admin/potential-buys/${id}/dismiss`);
}

export async function dismissPotentialBuysBulk(ids: string[]): Promise<{ message: string; dismissed: number }> {
  return api.authPost<{ message: string; dismissed: number }>('/admin/potential-buys/dismiss-bulk', { ids });
}

export async function dismissAllPotentialBuys(): Promise<{ message: string; dismissed: number }> {
  return api.authPost<{ message: string; dismissed: number }>('/admin/potential-buys/dismiss-all');
}

export async function markPotentialBuyPurchased(id: string): Promise<{ message: string }> {
  return api.authPatch<{ message: string }>(`/admin/potential-buys/${id}/purchased`);
}

export async function deletePotentialBuy(id: string): Promise<{ message: string }> {
  return api.authDelete<{ message: string }>(`/admin/potential-buys/${id}`);
}

export async function deleteAllPotentialBuys(): Promise<{ success: boolean; message: string; deleted: number }> {
  return api.authPost<{ success: boolean; message: string; deleted: number }>('/admin/potential-buys/cleanup?deleteAll=true');
}

// Deal Finder Scraper
export interface DealFinderResult {
  success: boolean;
  message: string;
  listingsChecked?: number;
  dealsFound?: number;
  duration?: string;
  error?: string;
}

export interface DealFinderStatus {
  isRunning: boolean;
}

export async function runDealFinder(): Promise<DealFinderResult> {
  return api.authPost<DealFinderResult>('/admin/run-deal-finder');
}

export async function getDealFinderStatus(): Promise<DealFinderStatus> {
  return api.authGet<DealFinderStatus>('/admin/deal-finder/status');
}

// User Management API
import type { AdminUser, PaginatedUsers, UpdateUserRequest } from './types/admin-user';

export async function getAdminUsers(
  search?: string,
  isAdmin?: boolean,
  isGuest?: boolean,
  emailVerified?: boolean,
  page = 1,
  perPage = 20
): Promise<PaginatedUsers> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (isAdmin !== undefined) params.set('isAdmin', String(isAdmin));
  if (isGuest !== undefined) params.set('isGuest', String(isGuest));
  if (emailVerified !== undefined) params.set('emailVerified', String(emailVerified));
  params.set('page', String(page));
  params.set('perPage', String(perPage));

  return api.authGet<PaginatedUsers>(`/admin/users?${params}`);
}

export async function updateAdminUser(
  id: string,
  data: UpdateUserRequest
): Promise<AdminUser> {
  return api.authPut<AdminUser>(`/admin/users/${id}`, data);
}

export async function deleteAdminUser(
  id: string
): Promise<{ success: boolean; message: string }> {
  return api.authDelete<{ success: boolean; message: string }>(`/admin/users/${id}`);
}

export default api;
