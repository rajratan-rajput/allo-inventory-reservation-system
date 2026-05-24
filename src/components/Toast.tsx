'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: (message: Omit<ToastMessage, 'id'>) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback(({ type, title, message, duration = 4000 }: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const success = useCallback((message: string, title?: string) => {
    toast({ type: 'success', title: title || 'Success', message });
  }, [toast]);

  const error = useCallback((message: string, title?: string) => {
    toast({ type: 'error', title: title || 'Error', message });
  }, [toast]);

  const warning = useCallback((message: string, title?: string) => {
    toast({ type: 'warning', title: title || 'Warning', message });
  }, [toast]);

  const info = useCallback((message: string, title?: string) => {
    toast({ type: 'info', title: title || 'Info', message });
  }, [toast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      
      {/* Toast Portal Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => {
          let typeClasses = '';
          let Icon = Info;

          switch (t.type) {
            case 'success':
              typeClasses = 'border-emerald-500 bg-emerald-950/90 text-emerald-200';
              Icon = CheckCircle;
              break;
            case 'error':
              typeClasses = 'border-rose-500 bg-rose-950/90 text-rose-200';
              Icon = AlertCircle;
              break;
            case 'warning':
              typeClasses = 'border-amber-500 bg-amber-950/90 text-amber-200';
              Icon = AlertTriangle;
              break;
            case 'info':
              typeClasses = 'border-sky-500 bg-sky-950/90 text-sky-200';
              Icon = Info;
              break;
          }

          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-bottom-5 pointer-events-auto ${typeClasses}`}
              role="alert"
            >
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                {t.title && <h4 className="font-semibold text-sm leading-tight text-white mb-0.5">{t.title}</h4>}
                <p className="text-xs font-medium leading-relaxed">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-current hover:text-white transition-colors duration-150 p-0.5 rounded-lg hover:bg-white/10 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
