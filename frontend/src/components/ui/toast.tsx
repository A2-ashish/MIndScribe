import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

type ToastAction = {
  label: string;
  href?: string; // if provided, navigate on click
  onClick?: () => void; // optional custom handler
  variant?: 'primary' | 'secondary';
};

export type Toast = {
  id: number;
  title?: string;
  description?: string;
  duration?: number; // ms
  variant?: 'default' | 'success' | 'error';
  action?: ToastAction;
};

type ToastContextValue = {
  toasts: Toast[];
  show: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let tid = 1;

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, any>());

  const dismiss = (id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  };

  const show = (t: Omit<Toast, 'id'>) => {
    const id = tid++;
    const toast: Toast = { id, duration: 3000, variant: 'default', ...t };
    setToasts((ts) => [...ts, toast]);
    if (toast.duration && toast.duration > 0) {
      const handle = setTimeout(() => dismiss(id), toast.duration);
      timers.current.set(id, handle);
    }
  };

  useEffect(() => () => timers.current.forEach((h) => clearTimeout(h)), []);

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
      <div aria-live="polite" aria-atomic="true" style={{ position: 'fixed', bottom: 76, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 420, padding: '0 12px' }}>
          {toasts.map((t) => (
            <div key={t.id}
                 role="status"
                 className={`rounded-md shadow-md border border-[var(--color-outline)] bg-white p-3 ${t.variant === 'success' ? 'text-green-700' : t.variant === 'error' ? 'text-red-700' : 'text-[var(--color-on-surface)]'}`}
                 style={{ pointerEvents: 'auto', transform: 'translateY(6px)', opacity: 0, animation: 'toast-in 200ms ease-out forwards' }}
            >
              {t.title && <div className="font-semibold mb-1">{t.title}</div>}
              {t.description && <div style={{ opacity: 0.9 }}>{t.description}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                {t.action && (
                  <button
                    onClick={() => {
                      const action = t.action;
                      if (!action) { dismiss(t.id); return; }
                      try {
                        if (action.onClick) action.onClick();
                        if (action.href) {
                            if (action.href.startsWith('#')) {
                              // Set hash without leading '#', browser will prepend one
                              window.location.hash = action.href.slice(1);
                            } else {
                              window.location.href = action.href;
                            }
                          }
                      } finally {
                        dismiss(t.id);
                      }
                    }}
                    className="text-sm"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      borderRadius: 8,
                      padding: '6px 10px',
                      border: (t.action?.variant === 'secondary') ? '1px solid var(--color-outline)' : '1px solid var(--color-accent)',
                      background: (t.action?.variant === 'secondary') ? '#fff' : 'var(--color-accent)',
                      color: (t.action?.variant === 'secondary') ? 'var(--color-on-surface)' : '#fff'
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
                <button onClick={() => dismiss(t.id)} className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span aria-hidden>✖</span> Close
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <Toaster/>');
  return ctx;
}
