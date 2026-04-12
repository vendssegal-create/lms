import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItemData {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (options: Omit<ToastItemData, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
} satisfies Record<ToastType, typeof Info>;

const BORDERS: Record<ToastType, string> = {
  success: 'border-success/20 bg-success/5',
  error: 'border-danger/20 bg-danger/5',
  info: 'border-primary/20 bg-primary/5',
  warning: 'border-warning/20 bg-warning/5',
};

function ToastItem({ item, onDismiss }: { key?: string | number; item: ToastItemData; onDismiss: (id: string) => void }) {
  const Icon = ICONS[item.type];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex items-start gap-3 rounded-2xl border bg-white px-4 py-4 shadow-2xl dark:bg-dark-card',
        BORDERS[item.type],
      )}
      role="alert"
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight text-text-primary">{item.title}</p>
        {item.description ? (
          <p className="mt-1 text-xs text-text-secondary">{item.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="rounded-lg p-1 text-text-secondary transition-colors hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/10"
        aria-label="Yopish"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: Omit<ToastItemData, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const duration = options.duration ?? 4000;
    setToasts((prev) => [...prev.slice(-5), { ...options, id }]);
    if (duration > 0) {
      window.setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(() => ({
    toast,
    success: (title, description) => toast({ type: 'success', title, description }),
    error: (title, description) => toast({ type: 'error', title, description, duration: 6000 }),
    info: (title, description) => toast({ type: 'info', title, description }),
    warning: (title, description) => toast({ type: 'warning', title, description }),
  }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex w-full max-w-sm flex-col gap-3" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
