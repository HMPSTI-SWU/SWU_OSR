'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  toast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-center justify-between rounded-geist-md px-4 py-3 text-body-sm geist-level-3 min-w-[300px] animate-slide-up',
              t.type === 'success' &&
                'bg-geist-canvas text-geist-ink border-l-2 border-l-geist-success dark:bg-neutral-900 dark:text-white dark:border-l-neutral-400',
              t.type === 'error' &&
                'bg-geist-canvas text-geist-ink border-l-2 border-l-geist-error dark:bg-neutral-900 dark:text-white dark:border-l-neutral-400',
              t.type === 'info' &&
                'bg-geist-canvas text-geist-ink border-l-2 border-l-geist-link dark:bg-neutral-900 dark:text-white dark:border-l-neutral-400'
            )}
          >
            <span>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="ml-3 text-geist-mute hover:text-geist-ink transition-colors dark:text-white dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
