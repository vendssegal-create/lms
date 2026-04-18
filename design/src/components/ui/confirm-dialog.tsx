import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Info, LoaderCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantConfig = {
  danger: {
    icon: AlertTriangle,
    iconClass: 'text-danger',
    iconBg: 'bg-danger/10',
    confirmClass: 'bg-danger text-white shadow-xl shadow-danger/20 hover:bg-red-600 hover:-translate-y-0.5',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-warning',
    iconBg: 'bg-warning/10',
    confirmClass: 'bg-warning text-white shadow-xl shadow-warning/20 hover:bg-amber-600 hover:-translate-y-0.5',
  },
  primary: {
    icon: CheckCircle,
    iconClass: 'text-primary',
    iconBg: 'bg-primary/10',
    confirmClass: 'btn-primary',
  },
} as const;

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Tasdiqlash',
  cancelLabel = 'Bekor qilish',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
      // Focus trap: keep Tab inside the dialog
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isLoading, onCancel]);

  // Focus the cancel button when dialog opens
  useEffect(() => {
    if (open) {
      // Defer so the element is visible before focusing
      const id = setTimeout(() => cancelRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  if (!open) return null;

  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      // Click outside to cancel (unless loading)
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-[28px] bg-card p-8 shadow-hover animate-slideUp"
        // Prevent clicks inside from bubbling to the backdrop
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          className={cn(
            'mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[20px]',
            config.iconBg,
          )}
        >
          <Icon size={32} className={config.iconClass} />
        </div>

        {/* Title */}
        <h2
          id="confirm-dialog-title"
          className="mb-2 text-center font-display text-xl font-bold text-text-primary"
        >
          {title}
        </h2>

        {/* Description */}
        <p
          id="confirm-dialog-description"
          className="mb-8 text-center text-sm leading-relaxed text-text-secondary"
        >
          {description}
        </p>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-outline flex-1 sm:flex-initial sm:min-w-[120px]"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>

          <button
            ref={confirmRef}
            type="button"
            className={cn(
              'btn flex-1 sm:flex-initial sm:min-w-[120px] transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
              config.confirmClass,
            )}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <LoaderCircle size={16} className="mr-2 animate-spin" />
                <span>Yuklanmoqda...</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ConfirmDialogProps };
