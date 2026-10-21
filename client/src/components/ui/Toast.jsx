import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

const STYLES = {
  error: 'bg-[var(--surface-raised)] border-[var(--autumn-clay)]/40 text-[var(--text)]',
  success: 'bg-[var(--surface-raised)] border-[var(--spring-sage)]/50 text-[var(--text)]',
  info: 'bg-[var(--surface-raised)] border-[var(--accent)]/35 text-[var(--text)]',
};

const ICON = {
  error: '!',
  success: '✓',
  info: 'i',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message, type = 'info', duration = 4500) => {
    const text = String(message || 'Something went wrong. Please try again.');
    const id = ++idRef.current;
    setToasts((prev) => {
      if (prev.some((toast) => toast.message === text && toast.type === type)) return prev;
      return [...prev.slice(-3), { id, message: text, type }];
    });
    if (duration) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const toast = useRef({
    error: (msg, duration) => push(msg, 'error', duration),
    success: (msg, duration) => push(msg, 'success', duration),
    info: (msg, duration) => push(msg, 'info', duration),
  }).current;

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed z-50 top-4 right-4 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`animate-toast-in shadow-lg rounded-2xl border px-4 py-3 text-sm flex items-start gap-3 backdrop-blur-md ${STYLES[t.type] || STYLES.info}`}
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-xs font-bold text-[var(--accent-dark)]">
              {ICON[t.type] || ICON.info}
            </span>
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded-full px-1 text-[var(--text-muted)] hover:bg-[var(--accent-light)] hover:text-[var(--text)]"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
