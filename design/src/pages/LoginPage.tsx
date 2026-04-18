import type { ReactNode } from 'react';
import { GraduationCap, LoaderCircle, LogIn, University } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/features/auth/auth-context';

// Animated floating orb — purely decorative
function Orb({ className }: { className: string }) {
  return <div aria-hidden="true" className={className} />;
}

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-6 text-white">
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(67,97,238,0.35),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(72,149,239,0.22),transparent_45%)]" />
      </div>

      {/* Floating orbs */}
      <Orb className="animate-float-slow pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <Orb className="animate-float-medium pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
      <Orb className="animate-float-fast pointer-events-none absolute left-1/2 top-1/3 h-48 w-48 -translate-x-1/2 rounded-full bg-accent/8 blur-2xl" />

      {/* Grid overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 w-full max-w-[460px]">
        {/* Logo + title */}
        <div className="mb-10 text-center">
          <div className="relative mx-auto inline-flex">
            <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary text-white shadow-2xl shadow-primary/40">
              <GraduationCap size={36} />
            </div>
            {/* glow ring */}
            <div className="animate-pulse-slow absolute inset-0 rounded-[28px] ring-4 ring-primary/30" />
          </div>
          <h1 className="mt-8 text-4xl font-black tracking-tight">Django LMS</h1>
          <p className="mt-2 text-sm font-medium text-white/50">
            O'zbekiston oliy ta'lim boshqaruv tizimi
          </p>
        </div>

        {children}

        <p className="mt-8 text-center text-xs font-medium text-white/25">
          HEMIS integratsiyalashgan · v2.0
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { session, login, isLoading } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  if (session?.authenticated) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await login({ username, password });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Login bajarilmadi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LoginShell>
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_40px_100px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {/* HEMIS SSO button */}
        <a
          href={session?.urls.hemis_login || '/auth/hemis/start/'}
          className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-success px-5 py-4 text-sm font-black text-white shadow-xl shadow-success/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-success/90 hover:shadow-success/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-success/40"
        >
          <University size={18} className="transition-transform duration-300 group-hover:scale-110" />
          HEMIS ID orqali kirish
        </a>

        <div className="relative my-7">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-transparent px-4 text-xs font-bold uppercase tracking-widest text-white/30">
              yoki
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-medium text-white/60">
              <LoaderCircle size={14} className="animate-spin flex-shrink-0 text-primary" />
              Sessiya tekshirilmoqda…
            </div>
          )}

          <div className="space-y-1.5">
            <label className="label-micro text-white/40">Login</label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-bold text-white outline-none transition-all placeholder:text-white/25 focus:border-primary/50 focus:bg-white/8 focus:ring-4 focus:ring-primary/15"
              placeholder="Login yoki talaba ID"
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="label-micro text-white/40">Parol</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-bold text-white outline-none transition-all placeholder:text-white/25 focus:border-primary/50 focus:bg-white/8 focus:ring-4 focus:ring-primary/15"
              placeholder="Parol"
              autoComplete="current-password"
              required
            />
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              <span className="mt-px flex-shrink-0">⚠</span>
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 py-4 text-sm font-black text-white shadow-xl shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-hover disabled:translate-y-0 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
          >
            {submitting ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Kirish…
              </>
            ) : (
              <>
                <LogIn size={18} />
                Tizimga kirish
              </>
            )}
          </button>
        </form>
      </div>
    </LoginShell>
  );
}
