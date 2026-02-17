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
        if (errorBody.error) errorMessage = errorBody.error;
        else if (errorBody.message) errorMessage = errorBody.message;
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
};

export default api;
