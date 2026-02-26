export interface AdminUserShippingAddress {
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface AdminUser {
  id: string;
  email: string | null;
  fullName: string;
  createdAt: string;
  isGuest: boolean;
  guestSessionId: string | null;
  shippingAddress: AdminUserShippingAddress | null;
  isAdmin: boolean;
  emailVerified: boolean;
}

export interface PaginatedUsers {
  items: AdminUser[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface UpdateUserRequest {
  email?: string;
  fullName?: string;
  isAdmin?: boolean;
  emailVerified?: boolean;
  isGuest?: boolean;
  shippingAddress?: AdminUserShippingAddress | null;
  clearShippingAddress?: boolean;
}
