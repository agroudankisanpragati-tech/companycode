'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

const ICONS = {
  success: <FaCheckCircle className="text-emerald-500" size={16} />,
  error:   <FaExclamationCircle className="text-red-500" size={16} />,
  info:    <FaInfoCircle className="text-blue-500" size={16} />,
  warning: <FaExclamationCircle className="text-amber-500" size={16} />,
};

const BG = {
  success: 'border-emerald-200 bg-emerald-50',
  error:   'border-red-200 bg-red-50',
  info:    'border-blue-200 bg-blue-50',
  warning: 'border-amber-200 bg-amber-50',
};

const TEXT = {
  success: 'text-emerald-800',
  error:   'text-red-800',
  info:    'text-blue-800',
  warning: 'text-amber-800',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ToastContainer({ toasts, onDismiss }: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg animate-slideDown ${BG[t.type]}`}
          role="alert"
        >
          <span className="flex-shrink-0 mt-0.5">{ICONS[t.type]}</span>
          <p className={`flex-1 text-sm font-medium ${TEXT[t.type]}`}>{t.message}</p>
          <button
            onClick={() => onDismiss(t.id)}
            className={`flex-shrink-0 rounded-full p-1 hover:bg-black/10 transition ${TEXT[t.type]}`}
            aria-label="Dismiss"
          >
            <FaTimes size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(p => p.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const show = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(p => [...p.slice(-4), { id, message, type }]);
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const toast = {
    success: (msg: string) => show(msg, 'success'),
    error:   (msg: string) => show(msg, 'error'),
    info:    (msg: string) => show(msg, 'info'),
    warning: (msg: string) => show(msg, 'warning'),
  };

  return { toasts, toast, dismiss };
}
