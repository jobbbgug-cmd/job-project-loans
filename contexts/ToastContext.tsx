'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

type ToastType = 'success' | 'error';
interface Toast { id: number; message: string; type: ToastType; }
interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  pendingToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {}, pendingToast: () => {} });

let _nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++_nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  // Show toast on current page
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    addToast(message, type);
  }, [addToast]);

  // Store toast in sessionStorage to show after navigation
  const pendingToast = useCallback((message: string, type: ToastType = 'success') => {
    sessionStorage.setItem('__toast__', JSON.stringify({ message, type }));
  }, []);

  // On mount, check if there's a pending toast from a previous page
  useEffect(() => {
    const raw = sessionStorage.getItem('__toast__');
    if (raw) {
      sessionStorage.removeItem('__toast__');
      try {
        const { message, type } = JSON.parse(raw) as { message: string; type: ToastType };
        addToast(message, type);
      } catch { /* ignore */ }
    }
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ showToast, pendingToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold animate-slide-down
            ${t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {t.type === 'success'
              ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            }
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
