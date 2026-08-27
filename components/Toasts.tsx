"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  visible: boolean; // drives CSS transition
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

// ─── Individual toast item ────────────────────────────────────────────────────

const BORDER: Record<ToastType, string> = {
  success: "border-emerald-500",
  error: "border-red-500",
  info: "border-indigo-500",
};

const LABEL_COLOR: Record<ToastType, string> = {
  success: "text-emerald-300",
  error: "text-red-300",
  info: "text-indigo-300",
};

const ICON: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "i",
};

const ICON_BG: Record<ToastType, string> = {
  success: "bg-emerald-500",
  error: "bg-red-500",
  info: "bg-indigo-500",
};

const AUTO_DISMISS_MS = 4000;

function ToastItem({
  t,
  onRemove,
}: {
  t: Toast;
  onRemove: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(t.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [t.id, onRemove]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 bg-slate-800 border border-slate-700 border-l-4 ${BORDER[t.type]} rounded-lg shadow-2xl transition-all duration-300 ${
        t.visible
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-6"
      }`}
    >
      {/* Icon */}
      <span
        className={`mt-0.5 shrink-0 w-4 h-4 rounded-full ${ICON_BG[t.type]} flex items-center justify-center text-white text-[9px] font-bold`}
      >
        {ICON[t.type]}
      </span>

      {/* Message */}
      <p className={`text-sm flex-1 leading-snug ${LABEL_COLOR[t.type]}`}>
        {t.message}
      </p>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => onRemove(t.id)}
        className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors text-xs leading-none mt-0.5"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    // Add hidden first
    setToasts((prev) => [...prev, { id, type, message, visible: false }]);
    // Flip visible after one frame to trigger CSS transition
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, visible: true } : t))
      );
    }, 30);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast stack — bottom-right, above everything */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
