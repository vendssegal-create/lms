import { AnimatePresence, motion } from 'motion/react';
import { Bell, BookOpen, CheckCircle2, Clock, ExternalLink, X, XCircle, AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLoginAlerts } from '@/src/api/lms';
import type { LoginAlert, NotifType, NotifPriority } from '@/src/types';

const SESSION_KEY = 'lms.login_alerts_shown';

function alertMeta(type: NotifType, priority: NotifPriority) {
  const urgent = priority === 'urgent';
  switch (type) {
    case 'course_enrolled':
      return { Icon: BookOpen, colour: 'text-primary', bg: 'bg-primary/10', label: 'Yangi kurs' };
    case 'deadline_warning':
      return {
        Icon: Clock,
        colour: urgent ? 'text-rose-500' : 'text-amber-500',
        bg: urgent ? 'bg-rose-50' : 'bg-amber-50',
        label: 'Muddat yaqin',
      };
    case 'deadline_overdue':
      return { Icon: AlertTriangle, colour: 'text-rose-600', bg: 'bg-rose-50', label: "Muddat o‘tdi" };
    case 'extension_approved':
      return { Icon: CheckCircle2, colour: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Tasdiqlandi' };
    case 'extension_rejected':
      return { Icon: XCircle, colour: 'text-rose-500', bg: 'bg-rose-50', label: 'Rad etildi' };
    default:
      return { Icon: Bell, colour: 'text-primary', bg: 'bg-primary/10', label: 'Xabar' };
  }
}

function AlertCard({ alert, index }: { key?: number; alert: LoginAlert; index: number }) {
  const { Icon, colour, bg, label } = alertMeta(alert.type, alert.priority);
  const isUrgent = alert.priority === 'urgent';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, delay: index * 0.06 }}
      className={`flex items-start gap-4 rounded-2xl border p-4 ${bg} ${isUrgent ? 'border-rose-200 ring-1 ring-rose-200/60' : 'border-border/50'}`}
    >
      <div className="relative mt-0.5 shrink-0">
        {isUrgent ? <span className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-30" /> : null}
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={colour} size={18} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${bg} ${colour}`}>
            {label}
          </span>
          {isUrgent ? (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
              Shoshilinch
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm font-bold leading-snug text-text-primary">{alert.title}</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-text-secondary">{alert.message}</p>
      </div>
      {alert.link ? (
        <Link
          to={alert.link}
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-text-secondary transition-colors hover:bg-slate-50 hover:text-primary"
        >
          <ExternalLink size={14} />
        </Link>
      ) : null}
    </motion.div>
  );
}

export function LoginAlertModal() {
  const [alerts, setAlerts] = useState<LoginAlert[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    fetchLoginAlerts()
      .then(({ alerts: items }) => {
        if (!items.length) return;
        sessionStorage.setItem(SESSION_KEY, '1');
        setAlerts(items);
        window.setTimeout(() => setOpen(true), 500);
      })
      .catch(() => {});
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const urgentCount = alerts.filter((a) => a.priority === 'urgent' || a.priority === 'high').length;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.3 }}
            className="fixed left-1/2 top-1/2 z-[91] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-white p-6 shadow-[0_32px_80px_rgba(0,0,0,0.18)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                  transition={{ duration: 0.7, delay: 0.35 }}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10"
                >
                  <Bell className="text-primary" size={22} />
                </motion.div>
                <div>
                  <h2 className="text-lg font-black text-text-primary">Xush kelibsiz!</h2>
                  <p className="text-xs font-medium text-text-secondary">
                    {urgentCount > 0 ? `${urgentCount} ta shoshilinch xabaringiz bor` : `${alerts.length} ta yangi bildirishnoma`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-text-secondary transition-colors hover:bg-slate-50 hover:text-text-primary"
                aria-label="Yopish"
              >
                <X size={16} />
              </button>
            </div>
            <div className="my-4 h-px bg-border/60" />
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
              {alerts.map((alert, i) => <AlertCard key={alert.id} alert={alert} index={i} />)}
            </div>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Link
                to="/notifications"
                onClick={close}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-primary transition-colors hover:bg-slate-50"
              >
                <Bell size={15} />
                Barcha bildirishnomalar
              </Link>
              <button type="button" onClick={close} className="btn btn-primary flex-1 sm:flex-none">
                Tushunarli
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

