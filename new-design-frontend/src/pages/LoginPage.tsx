import type { ReactNode } from 'react';
import { GraduationCap, LoaderCircle, LogIn, University } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/features/auth/auth-context';

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.28),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(79,70,229,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(5,150,105,0.15),transparent_40%)]" />
      <div className="relative z-10 w-full max-w-[480px]">
        <div className="mb-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-2xl shadow-emerald-900/40">
            <GraduationCap size={36} />
          </div>
          <h1 className="mt-8 font-display text-4xl font-bold tracking-tight">HEMIS LMS</h1>
          <p className="mt-3 text-sm font-medium text-white/65">Yangi interfeys · ta'lim boshqaruv tizimiga kirish</p>
        </div>
        {children}
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
        <div className="glass rounded-3xl p-8 text-left shadow-[0_40px_100px_rgba(0,0,0,0.4)]">
          <a href={session?.urls.hemis_login || '/auth/hemis/start/'} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-success px-5 py-4 text-sm font-black text-white transition-all hover:bg-success/90">
            <University size={18} />
            HEMIS ID orqali kirish
          </a>

          <div className="my-8 border-t border-white/10" />

          <form onSubmit={handleSubmit} className="space-y-5">
            {isLoading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/70">
                Sessiya tekshirilmoqda. Forma tayyor, server javobi kechiksa ham kirishni davom ettirishingiz mumkin.
              </div>
            ) : null}
            <div>
              <label className="label-micro text-white/50">Login</label>
              <input value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-bold text-white outline-none transition-all placeholder:text-white/30 focus:border-primary/40 focus:ring-4 focus:ring-primary/10" placeholder="Login yoki talaba ID" required />
            </div>
            <div>
              <label className="label-micro text-white/50">Parol</label>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-bold text-white outline-none transition-all placeholder:text-white/30 focus:border-primary/40 focus:ring-4 focus:ring-primary/10" placeholder="Parol" required />
            </div>
            {formError ? <p className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{formError}</p> : null}
            <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 py-4 text-sm font-black text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60">
              {submitting ? <LoaderCircle size={18} className="animate-spin" /> : <LogIn size={18} />}
              Tizimga kirish
            </button>
          </form>
        </div>
    </LoginShell>
  );
}
