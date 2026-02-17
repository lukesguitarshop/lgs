'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User,
  getStoredUser,
  getToken,
  login as authLogin,
  register as authRegister,
  logout as authLogout,
  getCurrentUser,
  isAuthenticated as checkIsAuthenticated,
} from '@/lib/auth';
import { clearCart } from '@/lib/cart';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  showRegisterModal: boolean;
  setShowRegisterModal: (show: boolean) => void;
  onRegisterSuccess: (() => void) | null;
  setOnRegisterSuccess: (callback: (() => void) | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [onRegisterSuccess, setOnRegisterSuccess] = useState<(() => void) | null>(null);

  const isAuthenticated = !!user && !user.isGuest;
  const isGuest = !!user && user.isGuest;
  const isAdmin = !!user && !user.isGuest && user.isAdmin;

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (token) {
        // Try to get user from localStorage first
        const storedUser = getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }

        // Then validate with API
        try {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        } catch {
          // Token invalid, clear auth
          authLogout();
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authLogin(email, password);
    setUser(response.user);
    setShowLoginModal(false);
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    const response = await authRegister(email, password, fullName);
    // With email verification, registration no longer returns a user/token
    // The RegisterModal handles showing the verification message
    if (response.user) {
      setUser(response.user);
      setShowRegisterModal(false);
      // Call the success callback if set, then clear it
      if (onRegisterSuccess) {
        onRegisterSuccess();
        setOnRegisterSuccess(null);
      }
    }
    // If only message returned, the RegisterModal will show the verification message
  }, [onRegisterSuccess]);

  const logout = useCallback(() => {
    authLogout();
    clearCart();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (checkIsAuthenticated()) {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch {
        authLogout();
        setUser(null);
      }
    }
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isGuest,
    isAdmin,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
    showLoginModal,
    setShowLoginModal,
    showRegisterModal,
    setShowRegisterModal,
    onRegisterSuccess,
    setOnRegisterSuccess,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
