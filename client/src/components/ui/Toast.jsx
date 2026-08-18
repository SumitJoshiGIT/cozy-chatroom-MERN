import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

const STYLES = {
  error: 'bg-red-50 border-red-200 text-red-700',
  success: 'bg-green-50 border-green-200 text-green-700',
  info: 'bg-white border-gray-200 text-gray-700',
};

const ICON = {
  error: '⚠',
  success: '✓',
  info: 'ℹ',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
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
      <div className="fixed z-50 top-4 right-4 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`animate-toast-in cursor-pointer shadow-lg rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${STYLES[t.type] || STYLES.info}`}
          >
            <span className="font-bold">{ICON[t.type] || ICON.info}</span>
            <span className="flex-1">{t.message}</span>
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
