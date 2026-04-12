import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle, Mail, Phone, Shield, UserCog } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createAdminTeacher } from '@/src/api/lms';

export default function AdminCreateTeacherPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
    department: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const payload = await createAdminTeacher(form);
      navigate(payload.redirect_path || '/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'O\'qituvchi yaratilmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/admin/dashboard" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-white text-text-muted shadow-sm transition-all hover:border-primary/20 hover:text-primary">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-text-primary">Yangi o'qituvchi qo'shish</h2>
          <p className="mt-1 text-sm font-medium text-text-secondary">Tizimga yangi teacher akkaunti yaratiladi.</p>
        </div>
      </div>

      <div className="card p-8 lg:p-12">
        <form onSubmit={handleSubmit} className="space-y-8">
          {error ? <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">{error}</div> : null}

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 text-primary">
                <Shield size={18} />
              </div>
              <h3 className="text-lg font-black tracking-tight text-text-primary">Akkaunt ma'lumotlari</h3>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder="Login" className="input" required />
              <input value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Parol" className="input" type="password" required />
            </div>
          </section>

          <section className="space-y-6 border-t border-slate-100 pt-8">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <UserCog size={18} />
              </div>
              <h3 className="text-lg font-black tracking-tight text-text-primary">Profil ma'lumotlari</h3>
            </div>
            <input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="To'liq ism" className="input" required />
            <div className="grid gap-6 md:grid-cols-2">
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="input pl-12" type="email" />
              </div>
              <div className="relative">
                <Phone size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Telefon" className="input pl-12" />
              </div>
            </div>
            <input value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} placeholder="Kafedra / Bo'lim" className="input" />
          </section>

          <div className="flex flex-col gap-4 pt-4 sm:flex-row">
            <Link to="/admin/dashboard" className="inline-flex flex-1 items-center justify-center rounded-2xl border border-border/60 bg-white px-6 py-4 text-sm font-black text-text-primary">
              Bekor qilish
            </Link>
            <button type="submit" disabled={isSaving} className="inline-flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-black text-white shadow-xl shadow-primary/20 disabled:cursor-not-allowed disabled:bg-slate-300">
              <CheckCircle size={18} />
              {isSaving ? 'Saqlanmoqda...' : 'O\'qituvchini saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
