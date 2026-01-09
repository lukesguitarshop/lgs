// API client utility for communicating with the .NET backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

export interface ApiError {
  message: string;
  status?: number;
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
      const error: ApiError = {
        message: `API request failed: ${response.statusText}`,
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
};

export default api;
