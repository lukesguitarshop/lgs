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

    // 204 carries no body; calling .json() on it throws. Endpoints use it to mean
    // "nothing here" (no featured listing, no review written yet), which is a normal
    // answer rather than an error.
    if (response.status === 204) {
      return null as T;
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
  perPage = 20,
  search?: string,
  minPrice?: number,
  maxPrice?: number
): Promise<PaginatedPotentialBuys> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (sort) params.set('sort', sort);
  params.set('page', String(page));
  params.set('perPage', String(perPage));
  if (search) params.set('search', search);
  if (minPrice != null) params.set('minPrice', String(minPrice));
  if (maxPrice != null) params.set('maxPrice', String(maxPrice));

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
  withPriceData?: number;
  lookupErrors?: number;
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

// Sweetwater Deal Finder API
import type { SweetwaterPotentialBuy, SweetwaterPotentialBuyStats, PaginatedSweetwaterPotentialBuys } from './types/sweetwater-potential-buy';

export async function getSweetwaterPotentialBuys(
  status?: string,
  sort?: string,
  page = 1,
  perPage = 20,
  search?: string,
  minPrice?: number,
  maxPrice?: number
): Promise<PaginatedSweetwaterPotentialBuys> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (sort) params.set('sort', sort);
  params.set('page', String(page));
  params.set('perPage', String(perPage));
  if (search) params.set('search', search);
  if (minPrice != null) params.set('minPrice', String(minPrice));
  if (maxPrice != null) params.set('maxPrice', String(maxPrice));

  return api.authGet<PaginatedSweetwaterPotentialBuys>(`/admin/sweetwater-potential-buys?${params}`);
}

export async function getSweetwaterPotentialBuyStats(): Promise<SweetwaterPotentialBuyStats> {
  return api.authGet<SweetwaterPotentialBuyStats>('/admin/sweetwater-potential-buys/stats');
}

export async function dismissSweetwaterPotentialBuy(id: string): Promise<{ message: string }> {
  return api.authPatch<{ message: string }>(`/admin/sweetwater-potential-buys/${id}/dismiss`);
}

export async function dismissSweetwaterPotentialBuysBulk(ids: string[]): Promise<{ message: string; dismissed: number }> {
  return api.authPost<{ message: string; dismissed: number }>('/admin/sweetwater-potential-buys/dismiss-bulk', { ids });
}

export async function dismissAllSweetwaterPotentialBuys(): Promise<{ message: string; dismissed: number }> {
  return api.authPost<{ message: string; dismissed: number }>('/admin/sweetwater-potential-buys/dismiss-all');
}

export async function markSweetwaterPotentialBuyPurchased(id: string): Promise<{ message: string }> {
  return api.authPatch<{ message: string }>(`/admin/sweetwater-potential-buys/${id}/purchased`);
}

export async function deleteAllSweetwaterPotentialBuys(): Promise<{ success: boolean; message: string; deleted: number }> {
  return api.authPost<{ success: boolean; message: string; deleted: number }>('/admin/sweetwater-potential-buys/cleanup?deleteAll=true');
}

export async function runSweetwaterDealFinder(): Promise<DealFinderResult> {
  return api.authPost<DealFinderResult>('/admin/run-sweetwater-deal-finder');
}

export async function getSweetwaterDealFinderStatus(): Promise<DealFinderStatus> {
  return api.authGet<DealFinderStatus>('/admin/sweetwater-deal-finder/status');
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

export interface ImpersonateResponse {
  token: string;
  expiresAt: string;
  user: import('./auth').User;
}

/**
 * Get a short-lived token that authenticates as the given customer
 */
export async function impersonateUser(id: string): Promise<ImpersonateResponse> {
  return api.authPost<ImpersonateResponse>(`/admin/users/${id}/impersonate`);
}

// Trade-in API
import type { TradeInRequestDto, AdminTradeInListItem, AdminTradeInDetail } from './types/trade-in';
import type { StoreCreditDto } from './types/store-credit';

export async function submitTradeIn(formData: FormData): Promise<{ id: string }> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}/trade-ins`, {
    method: 'POST',
    body: formData,
    headers,
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw { message: errBody.error || 'Submit failed', status: response.status } as ApiError;
  }
  return response.json();
}

export async function getMyTradeIns(): Promise<TradeInRequestDto[]> {
  return api.authGet<TradeInRequestDto[]>('/trade-ins/me');
}

export async function getTradeIn(id: string): Promise<TradeInRequestDto> {
  return api.authGet<TradeInRequestDto>(`/trade-ins/${id}`);
}

export async function acceptTradeInOffer(id: string, type: 'cash' | 'credit', paypalEmail?: string): Promise<TradeInRequestDto> {
  return api.authPost<TradeInRequestDto>(`/trade-ins/${id}/accept`, { type, paypalEmail });
}

export async function declineTradeInOffer(id: string): Promise<TradeInRequestDto> {
  return api.authPost<TradeInRequestDto>(`/trade-ins/${id}/decline`);
}

// Admin trade-in API
export async function getAdminTradeIns(status?: string): Promise<AdminTradeInListItem[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return api.authGet<AdminTradeInListItem[]>(`/admin/trade-ins${qs}`);
}

export async function getAdminTradeIn(id: string): Promise<AdminTradeInDetail> {
  return api.authGet<AdminTradeInDetail>(`/admin/trade-ins/${id}`);
}

export async function adminCreateTradeInOffer(id: string, cashOffer: number, storeCreditOffer: number, expirationDays: number): Promise<{ id: string }> {
  return api.authPost(`/admin/trade-ins/${id}/offer`, { cashOffer, storeCreditOffer, expirationDays });
}

export async function adminUploadTradeInLabel(id: string, file: File): Promise<{ labelUrl: string }> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const fd = new FormData();
  fd.append('label', file);
  const response = await fetch(`${API_BASE_URL}/admin/trade-ins/${id}/label`, {
    method: 'POST', body: fd, headers,
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw { message: errBody.error || 'Upload failed', status: response.status } as ApiError;
  }
  return response.json();
}

export async function adminMarkTradeInReceived(id: string): Promise<void> {
  await api.authPost(`/admin/trade-ins/${id}/mark-received`);
}

export async function adminMarkTradeInInspected(id: string, notes?: string): Promise<void> {
  await api.authPost(`/admin/trade-ins/${id}/mark-inspected`, { notes });
}

export async function adminCompleteTradeIn(id: string): Promise<void> {
  await api.authPost(`/admin/trade-ins/${id}/complete`);
}

export async function adminMarkTradeInPaid(id: string, paypalTransactionId?: string): Promise<void> {
  await api.authPost(`/admin/trade-ins/${id}/mark-paid`, { paypalTransactionId });
}

export async function adminCancelTradeIn(id: string): Promise<void> {
  await api.authPost(`/admin/trade-ins/${id}/cancel`);
}

export async function adminEditTradeIn(
  id: string,
  edits: { brand?: string; model?: string; condition?: string; notes?: string }
): Promise<void> {
  await api.authPatch(`/admin/trade-ins/${id}`, edits);
}

export async function adminDeleteTradeIn(id: string): Promise<void> {
  await api.authDelete(`/admin/trade-ins/${id}`);
}

export async function adminRejectTradeIn(id: string, reason?: string): Promise<void> {
  await api.authPost(`/admin/trade-ins/${id}/reject`, { reason });
}

// Store credit API
export async function getMyStoreCredit(): Promise<StoreCreditDto> {
  return api.authGet<StoreCreditDto>('/store-credit/me');
}

// Reservations API
import type {
  AdminReservation,
  ReservationSummary,
  ListingReservationState,
  DepositDetails,
  CreateReservationPayload,
  UpdateReservationPayload,
} from './types/reservation';

export async function getAdminReservations(opts: {
  status?: string;
  type?: string;
  activeOnly?: boolean;
} = {}): Promise<AdminReservation[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.type) params.set('type', opts.type);
  params.set('activeOnly', String(opts.activeOnly ?? true));
  return api.authGet<AdminReservation[]>(`/admin/reservations?${params}`);
}

export async function getReservationSummary(): Promise<ReservationSummary> {
  return api.authGet<ReservationSummary>('/admin/reservations/summary');
}

export async function createReservation(payload: CreateReservationPayload): Promise<AdminReservation> {
  return api.authPost<AdminReservation>('/admin/reservations', payload);
}

export async function updateReservation(
  id: string,
  payload: UpdateReservationPayload
): Promise<AdminReservation> {
  return api.authPut<AdminReservation>(`/admin/reservations/${id}`, payload);
}

export async function extendReservation(id: string, days: number): Promise<AdminReservation> {
  return api.authPost<AdminReservation>(`/admin/reservations/${id}/extend`, { days });
}

export async function markReservationDepositPaid(
  id: string,
  amount: number,
  paidAt: string | null,
  method: string
): Promise<AdminReservation> {
  return api.authPost<AdminReservation>(`/admin/reservations/${id}/mark-deposit-paid`, {
    amount,
    paidAt,
    method,
  });
}

export async function cancelReservation(
  id: string,
  reason: string,
  note: string | null,
  acknowledgeManualRefund: boolean
): Promise<AdminReservation> {
  return api.authPost<AdminReservation>(`/admin/reservations/${id}/cancel`, {
    reason,
    note,
    acknowledgeManualRefund,
  });
}

export async function convertReservationToSale(id: string): Promise<AdminReservation> {
  return api.authPost<AdminReservation>(`/admin/reservations/${id}/convert-to-sale`);
}

export async function migrateLegacyPending(): Promise<{
  success: boolean;
  found: number;
  created: number;
  skipped: number;
  errors: string[];
}> {
  return api.authPost('/admin/reservations/migrate-legacy-pending');
}

/**
 * Reservation state for a listing, from the caller's perspective.
 * Non-holders only ever receive the anonymous shape.
 */
export async function getListingReservation(listingId: string): Promise<ListingReservationState> {
  return api.authGet<ListingReservationState>(`/reservations/listing/${listingId}`);
}

// Deposit checkout
export async function getDepositDetails(reservationId: string): Promise<DepositDetails> {
  return api.authGet<DepositDetails>(`/checkout/deposit/${reservationId}`);
}

export async function createDepositStripeSession(
  reservationId: string
): Promise<{ sessionUrl: string; sessionId: string }> {
  return api.authPost(`/checkout/deposit/${reservationId}/stripe`);
}

export async function completeDepositStripe(
  reservationId: string,
  sessionId: string
): Promise<{ success: boolean; orderId: string; deposit_paid: number; balance_due: number }> {
  return api.authPost(`/checkout/deposit/${reservationId}/stripe/complete`, { sessionId });
}

export async function createDepositPayPalOrder(reservationId: string): Promise<{ orderId: string }> {
  return api.authPost(`/checkout/deposit/${reservationId}/paypal/create`);
}

export async function captureDepositPayPalOrder(
  reservationId: string,
  orderId: string
): Promise<{ success: boolean; orderId: string; deposit_paid: number; balance_due: number }> {
  return api.authPost(`/checkout/deposit/${reservationId}/paypal/capture`, { orderId });
}

// Admin activity feed API
export interface AdminActivityEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  type: string;
  description: string;
  listingId: string | null;
  createdAt: string;
}

export interface AdminActivityPage {
  items: AdminActivityEntry[];
  total: number;
  page: number;
  perPage: number;
}

export async function getAdminActivity(opts: {
  type?: string;
  userId?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  includeAdmin?: boolean;
} = {}): Promise<AdminActivityPage> {
  const params = new URLSearchParams();
  if (opts.type) params.set('type', opts.type);
  if (opts.userId) params.set('userId', opts.userId);
  if (opts.sort) params.set('sort', opts.sort);
  params.set('page', String(opts.page ?? 1));
  params.set('perPage', String(opts.perPage ?? 50));
  if (opts.includeAdmin) params.set('includeAdmin', 'true');
  return api.authGet<AdminActivityPage>(`/admin/activity?${params}`);
}

export default api;
