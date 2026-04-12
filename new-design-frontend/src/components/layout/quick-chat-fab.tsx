import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, RefreshCw, X } from 'lucide-react';
import { motion } from 'motion/react';
import { fetchThreads } from '@/src/api/messages';
import { saveQuickChatPreferences } from '@/src/api/auth';
import { useAuth } from '@/src/features/auth/auth-context';
import { preloadRoute } from '@/src/lib/route-preload';
import { cn } from '@/src/lib/utils';
import type { QuickChatPreferences } from '@/src/types';

type QuickChatFabProps = {
  unreadMessages: number;
  hasUnreadMessages: boolean;
  isMessagesRoute: boolean;
};

const STORAGE_KEY = 'lms.quick-chat.preferences';
const FAB_SIZE = 60;
const EDGE_GAP = 20;
const TOP_GAP = 96;
const BOTTOM_GAP = 24;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMaxY() {
  if (typeof window === 'undefined') return 480;
  return Math.max(TOP_GAP, window.innerHeight - FAB_SIZE - BOTTOM_GAP);
}

function loadGuestPreferences(): QuickChatPreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QuickChatPreferences>;
    if (parsed.side !== 'left' && parsed.side !== 'right') return null;
    return {
      side: parsed.side,
      offset_y: typeof parsed.offset_y === 'number' ? parsed.offset_y : 140,
      is_collapsed: typeof parsed.is_collapsed === 'boolean' ? parsed.is_collapsed : true,
    };
  } catch {
    return null;
  }
}

function getDefaultPreferences(sessionPrefs?: QuickChatPreferences): QuickChatPreferences {
  return sessionPrefs || loadGuestPreferences() || { side: 'right', offset_y: 140, is_collapsed: true };
}

function MiniThreadList({
  isOpen,
  unreadMessages,
}: {
  isOpen: boolean;
  unreadMessages: number;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Awaited<ReturnType<typeof fetchThreads>> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    void fetchThreads()
      .then((response) => {
        if (active) setThreads(response);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Chat yuklanmadi.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-5 py-4">
        <p className="label-micro">Quick Chat</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-text-primary">Xabarlar</h3>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
            {unreadMessages} unread
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm font-bold text-text-secondary">
            <RefreshCw size={16} className="animate-spin text-primary" />
            Chat yuklanmoqda...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600">{error}</div>
        ) : threads?.items.length ? (
          <div className="space-y-3">
            {threads.items.slice(0, 6).map((thread) => (
              <Link
                key={thread.id}
                to={`/messages/${thread.id}`}
                onMouseEnter={() => preloadRoute('/messages')}
                className="block rounded-2xl border border-border bg-slate-50 px-4 py-3 transition-all hover:border-primary/30 hover:bg-white"
              >
                <div className="flex items-start gap-3">
                  <img src={thread.other_user.avatar_url} alt={thread.other_user.full_name} className="h-10 w-10 rounded-2xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-black text-text-primary">{thread.other_user.full_name}</p>
                      {thread.unread_count ? (
                        <span className="rounded-full bg-danger px-2 py-1 text-[10px] font-black text-white">{thread.unread_count}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-text-secondary">
                      {thread.last_message?.body || thread.last_message?.attachment_name || 'Hozircha xabar yo‘q'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-5 text-sm font-medium text-text-secondary">
            Hozircha chatlar yo‘q.
          </div>
        )}
      </div>

      <div className="border-t border-border/60 p-4">
        <Link
          to="/messages"
          onMouseEnter={() => preloadRoute('/messages')}
          onFocus={() => preloadRoute('/messages')}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white"
        >
          To‘liq chatni ochish
        </Link>
      </div>
    </div>
  );
}

export function QuickChatFab({ unreadMessages, hasUnreadMessages, isMessagesRoute }: QuickChatFabProps) {
  const { session } = useAuth();
  const isAuthenticated = Boolean(session?.authenticated && session.user);

  const [prefs, setPrefs] = useState<QuickChatPreferences>(() => getDefaultPreferences(session?.user?.quick_chat));
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight));
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const nextPrefs = getDefaultPreferences(session?.user?.quick_chat);
    setPrefs((current) => ({
      side: nextPrefs.side,
      offset_y: clamp(current.offset_y || nextPrefs.offset_y, TOP_GAP, getMaxY()),
      is_collapsed: current.is_collapsed,
    }));
  }, [session?.user?.quick_chat]);

  useEffect(() => {
    const onResize = () => {
      setViewportHeight(window.innerHeight);
      setPrefs((current) => ({
        ...current,
        offset_y: clamp(current.offset_y, TOP_GAP, getMaxY()),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (!isAuthenticated) return;
    const timer = window.setTimeout(() => {
      void saveQuickChatPreferences(prefs).catch(() => {});
    }, 250);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, prefs]);

  const xPosition = useMemo(() => {
    if (typeof window === 'undefined') return EDGE_GAP;
    return prefs.side === 'left' ? EDGE_GAP : window.innerWidth - FAB_SIZE - EDGE_GAP;
  }, [prefs.side, viewportHeight]);

  const panelClasses = prefs.side === 'left' ? 'left-[92px] origin-left' : 'right-[92px] origin-right';

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.08}
        dragConstraints={{
          top: TOP_GAP,
          bottom: getMaxY(),
          left: EDGE_GAP,
          right: Math.max(EDGE_GAP, (typeof window !== 'undefined' ? window.innerWidth : 1280) - FAB_SIZE - EDGE_GAP),
        }}
        onDragStart={() => {
          setPrefs((current) => ({ ...current, is_collapsed: true }));
        }}
        onDragEnd={(_event, info) => {
          if (typeof window === 'undefined') return;
          const nextSide = info.point.x + FAB_SIZE / 2 < window.innerWidth / 2 ? 'left' : 'right';
          setPrefs((current) => ({
            ...current,
            side: nextSide,
            offset_y: clamp(info.point.y, TOP_GAP, getMaxY()),
            is_collapsed: true,
          }));
        }}
        animate={{ x: xPosition, y: clamp(prefs.offset_y, TOP_GAP, getMaxY()) }}
        transition={{ type: 'spring', stiffness: 480, damping: 36, mass: 0.8 }}
        className="pointer-events-auto absolute top-0 left-0"
        style={{ touchAction: 'none' }}
      >
        {!prefs.is_collapsed ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className={cn(
              'absolute top-0 w-[min(360px,calc(100vw-110px))] overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl',
              panelClasses,
            )}
          >
            <div className="absolute right-4 top-4 z-10">
              <button
                type="button"
                onClick={() => setPrefs((current) => ({ ...current, is_collapsed: true }))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-white text-text-secondary"
                aria-label="Chatni yopish"
              >
                <X size={16} />
              </button>
            </div>
            <div className="h-[460px] pt-2">
              <MiniThreadList isOpen={!prefs.is_collapsed} unreadMessages={unreadMessages} />
            </div>
          </motion.div>
        ) : null}

        <button
          type="button"
          onMouseEnter={() => preloadRoute('/messages')}
          onFocus={() => preloadRoute('/messages')}
          onClick={() => setPrefs((current) => ({ ...current, is_collapsed: !current.is_collapsed }))}
          className={cn(
            'relative flex h-[60px] w-[60px] items-center justify-center rounded-full border shadow-2xl backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_-24px_rgba(67,97,238,0.45)]',
            isMessagesRoute ? 'border-slate-950/70 bg-slate-950 text-white shadow-slate-950/20' : 'border-white/70 bg-white/92 text-text-primary shadow-primary/15',
            hasUnreadMessages && !isMessagesRoute ? 'animate-fab-nudge' : '',
          )}
          aria-label={prefs.is_collapsed ? 'Quick Chatni ochish' : 'Quick Chatni yopish'}
        >
          <span
            className={cn(
              'relative flex h-11 w-11 items-center justify-center rounded-full shadow-lg',
              isMessagesRoute ? 'bg-white/12 text-white' : 'bg-primary text-white shadow-primary/30',
            )}
          >
            <MessageCircle size={18} />
            {hasUnreadMessages ? (
              <>
                <span className={cn('absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full', isMessagesRoute ? 'bg-success/70' : 'bg-success/55', !isMessagesRoute ? 'animate-unread-ping' : '')} />
                <span className={cn('absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2', isMessagesRoute ? 'border-slate-950 bg-success' : 'border-white bg-success')} />
              </>
            ) : null}
          </span>
          {hasUnreadMessages ? (
            <span className={cn('absolute -right-1 -top-1 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-1 text-[10px] font-black', isMessagesRoute ? 'bg-white/12 text-white' : 'bg-primary text-white shadow-lg shadow-primary/25')}>
              {unreadMessages > 99 ? '99+' : unreadMessages}
            </span>
          ) : null}
        </button>
      </motion.div>
    </div>
  );
}
