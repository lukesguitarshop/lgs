'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info', duration = 5000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* On phones the stack sits just above where a <StickyBar> would be (64px + safe area),
          so a toast never lands on top of the page's primary action. */}
      <div className="fixed inset-x-5 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-50 flex flex-col gap-2 md:inset-x-auto md:right-4 md:bottom-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 py-1.5 pl-4 pr-1.5 animate-slide-up md:min-w-[300px] md:max-w-[400px] ${
              toast.type === 'success'
                ? 'bg-foreground text-background'
                : toast.type === 'error'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted-foreground text-foreground'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="h-5 w-5 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="h-5 w-5 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="h-5 w-5 flex-shrink-0" />}
            <p className="flex-1 text-[15px] font-medium">{toast.message}</p>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center hover:bg-background/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <style jsx global>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </ToastContext.Provider>
  );
}
