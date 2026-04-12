import { FormEvent, useEffect, useMemo, useState } from 'react';
import { KeyRound, LoaderCircle, Mail, Phone, Save, Shield, UserCircle2 } from 'lucide-react';
import { changePassword, fetchProfile, updateProfile } from '@/src/api/profile';
import { useAuth } from '@/src/features/auth/auth-context';
import { ProfileResponse } from '@/src/types';

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-border p-5">
      <p className="label-micro">{label}</p>
      <p className="mt-3 text-sm font-bold text-text-primary">{value || 'Kiritilmagan'}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { refreshSession } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    avatar: null as File | null,
  });

  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchProfile();
        if (!active) {
          return;
        }
        setProfile(response);
        setForm({
          first_name: response.user.first_name || '',
          last_name: response.user.last_name || '',
          email: response.user.email || '',
          phone: response.user.phone || '',
          avatar: null,
        });
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Profil yuklanmadi.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const avatarUrl = useMemo(() => {
    const name = profile?.user.full_name || profile?.user.username || 'User';
    return profile?.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4361ee&color=fff&size=180`;
  }, [profile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const payload = new FormData();
    payload.set('first_name', form.first_name);
    payload.set('last_name', form.last_name);
    payload.set('email', form.email);
    payload.set('phone', form.phone);
    if (form.avatar) {
      payload.set('avatar', form.avatar);
    }

    try {
      const response = await updateProfile(payload);
      setProfile(response.profile);
      setSuccess('Profil yangilandi.');
      await refreshSession({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profil yangilanmadi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    const payload = new URLSearchParams();
    payload.set('old_password', passwordForm.old_password);
    payload.set('new_password', passwordForm.new_password);
    payload.set('confirm_password', passwordForm.confirm_password);

    try {
      await changePassword(payload);
      setPasswordSuccess('Parol yangilandi.');
      setPasswordForm({
        old_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Parol yangilanmadi.');
    } finally {
      setIsChangingPassword(false);
    }
  }

  if (isLoading) {
    return (
      <div className="card flex min-h-[320px] items-center justify-center gap-3 p-8 text-text-secondary">
        <LoaderCircle className="animate-spin text-primary" size={20} />
        Profil yuklanmoqda...
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="card p-8">
        <p className="text-lg font-black text-text-primary">Profil yuklanmadi</p>
        <p className="mt-3 text-sm font-medium text-rose-500">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="card p-8">
        <div className="flex flex-col items-center text-center">
          <img src={avatarUrl} alt={profile.user.full_name} className="h-32 w-32 rounded-[32px] object-cover" />
          <h2 className="mt-6 text-3xl font-black tracking-tight text-text-primary">{profile.user.full_name}</h2>
          <p className="mt-2 label-micro text-primary">{profile.user.active_role_label}</p>
        </div>
        <div className="mt-8 space-y-4">
          <InfoBlock label="Username" value={profile.user.username} />
          <InfoBlock label="Asosiy rol" value={profile.roles.account_role_label} />
          <InfoBlock label="Faol rol" value={profile.roles.active_role_label} />
        </div>
        {profile.roles.roles_differ ? (
          <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
            Menyular va ruxsatlar hozir faol rol bo'yicha ishlayapti.
          </div>
        ) : null}
      </section>

      <section className="space-y-6">
        <div className="card p-8">
          <div className="flex items-center gap-3">
            <UserCircle2 className="text-primary" size={20} />
            <h3 className="text-2xl font-black tracking-tight text-text-primary">Profil ma'lumotlari</h3>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-border p-5">
              <p className="label-micro">Email</p>
              <div className="mt-3 flex items-center gap-3 text-sm font-bold text-text-primary">
                <Mail size={16} className="text-primary" />
                <span>{profile.user.email || 'Kiritilmagan'}</span>
              </div>
            </div>
            <div className="rounded-[24px] border border-border p-5">
              <p className="label-micro">Telefon</p>
              <div className="mt-3 flex items-center gap-3 text-sm font-bold text-text-primary">
                <Phone size={16} className="text-primary" />
                <span>{profile.user.phone || 'Kiritilmagan'}</span>
              </div>
            </div>
          </div>
        </div>

        {profile.student_profile ? (
          <div className="card p-8">
            <div className="flex items-center gap-3">
              <Shield className="text-primary" size={20} />
              <h3 className="text-2xl font-black tracking-tight text-text-primary">Akademik ma'lumotlar</h3>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <InfoBlock label="Student ID" value={profile.student_profile.student_id_number} />
              <InfoBlock label="Fakultet" value={profile.student_profile.faculty_name} />
              <InfoBlock label="Guruh" value={profile.student_profile.group_name} />
              <InfoBlock label="Mutaxassislik" value={profile.student_profile.specialty_name} />
              <InfoBlock label="Ta'lim shakli" value={`${profile.student_profile.education_form} ${profile.student_profile.education_type}`.trim()} />
              <InfoBlock label="Holat" value={profile.student_profile.student_status} />
            </div>
          </div>
        ) : null}

        {profile.teacher_profile ? (
          <div className="card p-8">
            <div className="flex items-center gap-3">
              <Shield className="text-primary" size={20} />
              <h3 className="text-2xl font-black tracking-tight text-text-primary">Lavozim ma'lumotlari</h3>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <InfoBlock label="Kafedra" value={profile.teacher_profile.department} />
              <InfoBlock label="Lavozim" value={profile.teacher_profile.hemis_position} />
              <InfoBlock label="HEMIS ID" value={profile.teacher_profile.hemis_id} />
              <InfoBlock label="Tajriba" value={`${profile.teacher_profile.experience_years} yil`} />
            </div>
          </div>
        ) : null}

        <div className="card p-8">
          <h3 className="text-2xl font-black tracking-tight text-text-primary">Shaxsiy ma'lumotlarni yangilash</h3>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="label-micro">Ism</span>
                <input
                  className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none transition-all focus:border-primary/30 focus:bg-white"
                  value={form.first_name}
                  onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))}
                />
              </label>
              <label className="space-y-2">
                <span className="label-micro">Familiya</span>
                <input
                  className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none transition-all focus:border-primary/30 focus:bg-white"
                  value={form.last_name}
                  onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))}
                />
              </label>
              <label className="space-y-2">
                <span className="label-micro">Email</span>
                <input
                  type="email"
                  className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none transition-all focus:border-primary/30 focus:bg-white"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>
              <label className="space-y-2">
                <span className="label-micro">Telefon</span>
                <input
                  className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none transition-all focus:border-primary/30 focus:bg-white"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </label>
            </div>
            <label className="block space-y-2">
              <span className="label-micro">Avatar</span>
              <input
                type="file"
                accept="image/*"
                className="w-full rounded-2xl border border-dashed border-border bg-slate-50 px-4 py-4 text-sm font-medium text-text-secondary"
                onChange={(event) => setForm((current) => ({ ...current, avatar: event.target.files?.[0] || null }))}
              />
            </label>
            {success ? <p className="text-sm font-semibold text-emerald-600">{success}</p> : null}
            {error ? <p className="text-sm font-semibold text-rose-500">{error}</p> : null}
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
              Saqlash
            </button>
          </form>
        </div>

        <div className="card p-8">
          <div className="flex items-center gap-3">
            <KeyRound className="text-warning" size={20} />
            <h3 className="text-2xl font-black tracking-tight text-text-primary">Parolni yangilash</h3>
          </div>
          <form className="mt-8 space-y-4" onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              placeholder="Eski parol"
              className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none transition-all focus:border-primary/30 focus:bg-white"
              value={passwordForm.old_password}
              onChange={(event) => setPasswordForm((current) => ({ ...current, old_password: event.target.value }))}
            />
            <input
              type="password"
              placeholder="Yangi parol"
              className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none transition-all focus:border-primary/30 focus:bg-white"
              value={passwordForm.new_password}
              onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))}
            />
            <input
              type="password"
              placeholder="Yangi parolni tasdiqlang"
              className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm font-semibold text-text-primary outline-none transition-all focus:border-primary/30 focus:bg-white"
              value={passwordForm.confirm_password}
              onChange={(event) => setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))}
            />
            {passwordSuccess ? <p className="text-sm font-semibold text-emerald-600">{passwordSuccess}</p> : null}
            {passwordError ? <p className="text-sm font-semibold text-rose-500">{passwordError}</p> : null}
            <button
              type="submit"
              disabled={isChangingPassword}
              className="inline-flex items-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-bold text-text-primary transition-all hover:border-primary/20 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isChangingPassword ? <LoaderCircle className="animate-spin" size={16} /> : <KeyRound size={16} />}
              Parolni yangilash
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
