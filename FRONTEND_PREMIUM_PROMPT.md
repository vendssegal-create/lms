# Frontend Premium UI/UX — Senior Developer Prompt

## Loyiha konteksti

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS v4 + Lucide React + React Router DOM  
**Dizayn tizimi (mavjud):**  
- Fontlar: `Inter` (body), `Space Grotesk` (headings), `JetBrains Mono` (code)  
- Ranglar: `primary: #4361EE`, `success: #10B981`, `warning: #F59E0B`, `danger: #EF4444`  
- Komponentlar: `.card`, `.btn`, `.btn-primary`, `.btn-outline`, `.input`, `.status-pill`, `.label-micro`, `.shimmer`, `.glass`, `.mesh-bg`  
- Barcha fayllar: `design/src/` papkasida

**Holat:** Asosiy funksional ishlaydi. UI yaxshi boshlanish nuqtasiga ega, lekin premium darajaga ko'tarish kerak.

---

## MUAMMO TAHLILI — Nima yetishmayapti

| Soha | Hozirgi holat | Kerak bo'lgan daraja |
|---|---|---|
| Dark mode | Yo'q | To'liq qo'llab-quvvatlash |
| Sahifa o'tishlari | Yo'q | Framer Motion animatsiyalar |
| Stat animatsiyalar | Statik raqam | Animatsion counter |
| Test sahifasi | Oddiy radio list | Full-screen, navigator panel |
| Toast bildirisnomalar | Inline xato matni | Global toast tizimi |
| Yuklanish holati | Bitta spinner | Har sahifa uchun skeleton |
| Mobil navigatsiya | Faqat sidebar | Bottom navigation bar |
| Bo'sh holat | Text xabar | Illustrated empty states |
| Command palette | Yo'q | Ctrl+K global qidiruv |
| Diagram / chart | Yo'q | Progress grafiklari |
| Konfetti | Yo'q | Test tugaganda tabriklash |
| Form UX | Oddiy input | Drag-drop, inline validation |

---

## 1-QISM — Dizayn tizimini kengaytirish

### 1.1 Dark mode — `design/src/index.css`

`@theme` blokiga dark mode o'zgaruvchilarini qo'shing:

```css
@theme {
  /* ... mavjud tokenlar ... */
  
  /* Dark mode tokenlar */
  --color-dark-bg: #0A0F1E;
  --color-dark-card: #111827;
  --color-dark-border: #1F2937;
  --color-dark-text-primary: #F1F5F9;
  --color-dark-text-secondary: #94A3B8;
  --color-dark-surface: #1A2235;
}

/* Dark mode media query */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: var(--color-dark-bg);
    --color-card: var(--color-dark-card);
    --color-border: var(--color-dark-border);
    --color-text-primary: var(--color-dark-text-primary);
    --color-text-secondary: var(--color-dark-text-secondary);
  }
}

/* Manual dark class */
.dark {
  --color-background: var(--color-dark-bg);
  --color-card: var(--color-dark-card);
  --color-border: var(--color-dark-border);
  --color-text-primary: var(--color-dark-text-primary);
  --color-text-secondary: var(--color-dark-text-secondary);
}
```

`ThemeProvider` kontekst yarating (`design/src/features/theme/theme-context.tsx`):

```tsx
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const ThemeContext = createContext<{
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}>({ theme: 'system', resolvedTheme: 'light', setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem('lms.theme') as Theme) || 'system'
  );
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
    setResolvedTheme(resolved);
    root.classList.toggle('dark', resolved === 'dark');
  }, [theme]);

  function setTheme(next: Theme) {
    localStorage.setItem('lms.theme', next);
    setThemeState(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

`app-shell.tsx` headeriga dark mode toggle tugma qo'shing:

```tsx
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/src/features/theme/theme-context';

// Header ichida:
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; icon: LucideIcon }[] = [
    { value: 'light', icon: Sun },
    { value: 'dark', icon: Moon },
    { value: 'system', icon: Monitor },
  ];
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-border bg-white dark:bg-dark-surface p-1">
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'rounded-xl p-2 transition-colors',
            theme === value
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          )}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
```

### 1.2 Rol-asosiy ranglar

O'qituvchi va talaba uchun rang aksentlari:

```tsx
// design/src/lib/role-theme.ts
export const ROLE_THEME = {
  STUDENT: {
    accent: '#4361EE',      // primary blue
    accentLight: '#EEF2FF',
    label: 'Talaba',
    gradient: 'from-blue-500 to-indigo-600',
  },
  TEACHER: {
    accent: '#10B981',      // emerald
    accentLight: '#ECFDF5',
    label: "O'qituvchi",
    gradient: 'from-emerald-500 to-teal-600',
  },
  SUPER_ADMIN: {
    accent: '#8B5CF6',      // violet
    accentLight: '#F5F3FF',
    label: 'Super Admin',
    gradient: 'from-violet-500 to-purple-600',
  },
} as const;
```

---

## 2-QISM — Global Toast tizimi

### 2.1 `design/src/components/ui/toast.tsx` yarating

```tsx
import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/src/lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

const ToastContext = createContext<{
  toast: (options: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}>({} as never);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((options: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const duration = options.duration ?? 4000;
    setToasts(prev => [...prev, { ...options, id }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const success = useCallback((title: string, description?: string) =>
    toast({ type: 'success', title, description }), [toast]);
  const error = useCallback((title: string, description?: string) =>
    toast({ type: 'error', title, description, duration: 6000 }), [toast]);
  const info = useCallback((title: string, description?: string) =>
    toast({ type: 'info', title, description }), [toast]);
  const warning = useCallback((title: string, description?: string) =>
    toast({ type: 'warning', title, description }), [toast]);

  const ICONS = {
    success: <CheckCircle2 size={18} className="text-success" />,
    error: <AlertCircle size={18} className="text-danger" />,
    info: <Info size={18} className="text-primary" />,
    warning: <AlertTriangle size={18} className="text-warning" />,
  };

  const BORDERS = {
    success: 'border-success/20 bg-success/5',
    error: 'border-danger/20 bg-danger/5',
    info: 'border-primary/20 bg-primary/5',
    warning: 'border-warning/20 bg-warning/5',
  };

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 w-full max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-2xl border bg-white dark:bg-dark-card px-4 py-4 shadow-2xl',
              'animate-slideUp',
              BORDERS[t.type]
            )}
          >
            <div className="mt-0.5 flex-shrink-0">{ICONS[t.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-primary">{t.title}</p>
              {t.description && (
                <p className="mt-1 text-xs font-medium text-text-secondary">{t.description}</p>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-text-muted hover:text-text-primary">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
```

`design/src/app/providers.tsx` ga qo'shing:
```tsx
<ThemeProvider>
  <ToastProvider>
    <AuthProvider>
      {children}
    </AuthProvider>
  </ToastProvider>
</ThemeProvider>
```

---

## 3-QISM — Sahifa o'tish animatsiyalari

### 3.1 O'rnatish

```bash
cd design && npm install framer-motion
```

### 3.2 `design/src/components/ui/page-transition.tsx`

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const variants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="initial"
        animate="enter"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

`app-shell.tsx` da `<Outlet />` ni o'rang:
```tsx
<main className="flex-1 px-6 py-8 lg:px-8 lg:py-10">
  <PageTransition>
    <Outlet />
  </PageTransition>
</main>
```

### 3.3 Stagger list animatsiyasi

```tsx
// design/src/components/ui/stagger-list.tsx
import { motion } from 'framer-motion';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export function StaggerList({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div variants={item} className={className}>{children}</motion.div>;
}
```

Kurslar ro'yxatida ishlatish:
```tsx
<StaggerList>
  {courses.map(course => (
    <StaggerItem key={course.id}>
      <CourseCard course={course} ... />
    </StaggerItem>
  ))}
</StaggerList>
```

---

## 4-QISM — Animatsion Stat Counter

### 4.1 `design/src/components/ui/animated-counter.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({
  value,
  duration = 1200,
  prefix = '',
  suffix = '',
  className,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const startTime = useRef<number | null>(null);
  const startValue = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    startValue.current = display;
    startTime.current = null;

    function tick(timestamp: number) {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startValue.current + (value - startValue.current) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return (
    <span className={className}>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
}
```

`DashboardPage.tsx` da:
```tsx
// StatCard ichida:
<p className="mt-3 text-4xl font-black tracking-tight text-text-primary">
  {typeof stat.value === 'number'
    ? <AnimatedCounter value={stat.value} />
    : stat.value
  }
</p>
```

---

## 5-QISM — Test sahifasini qayta qurish (TakeTestPage)

### 5.1 Full-screen, fokus rejimi

```tsx
// TakeTestPage.tsx — asosiy layout o'zgarishi

// Full-screen wrapper (sidebar yo'q):
// Layout: 3 ustun — [Savol navigatori | Savol kontenti | Timer & info]

export default function TakeTestPage() {
  // ... mavjud holat ...
  const [currentQuestion, setCurrentQuestion] = useState(0);

  return (
    // Full-viewport, sidebar bilan qoplanmasin
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* TOP BAR */}
      <header className="flex items-center justify-between border-b border-border bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center">
            <FlaskConical size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Test</p>
            <h1 className="text-lg font-black text-text-primary">{data?.test.name}</h1>
          </div>
        </div>

        {/* Visual countdown timer */}
        <TimerWidget remaining={remaining} total={data?.test.duration_minutes * 60 || 0} />

        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-text-secondary">
            {answeredCount}/{totalQuestions} javob berildi
          </span>
          <button
            onClick={() => setConfirmSubmit(true)}
            className="btn btn-primary"
          >
            Topshirish
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Question Navigator */}
        <QuestionNavigator
          questions={data?.questions || []}
          answers={answers}
          currentIndex={currentQuestion}
          onSelect={setCurrentQuestion}
        />

        {/* Center: Question */}
        <main className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {data?.questions[currentQuestion] && (
                <QuestionCard
                  index={currentQuestion + 1}
                  question={data.questions[currentQuestion]}
                  value={answers[String(data.questions[currentQuestion].id)] || ''}
                  onChange={(val) => setAnswers(prev => ({
                    ...prev,
                    [String(data.questions[currentQuestion].id)]: val,
                  }))}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Prev / Next nav */}
          <div className="mt-8 flex justify-between">
            <button
              disabled={currentQuestion === 0}
              onClick={() => setCurrentQuestion(q => q - 1)}
              className="btn btn-outline disabled:opacity-40"
            >
              ← Oldingi
            </button>
            <button
              disabled={currentQuestion >= totalQuestions - 1}
              onClick={() => setCurrentQuestion(q => q + 1)}
              className="btn btn-primary disabled:opacity-40"
            >
              Keyingi →
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
```

### 5.2 Savol navigatori komponenti

```tsx
function QuestionNavigator({
  questions,
  answers,
  currentIndex,
  onSelect,
}: {
  questions: TakeTestQuestion[];
  answers: Record<string, string>;
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-border bg-slate-50/80 p-4 overflow-y-auto">
      <p className="label-micro mb-4">Savollar</p>
      <div className="grid grid-cols-5 gap-2">
        {questions.map((q, idx) => {
          const answered = Boolean(answers[String(q.id)]);
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={q.id}
              onClick={() => onSelect(idx)}
              className={cn(
                'h-10 w-10 rounded-xl text-sm font-black transition-all',
                isCurrent && 'ring-2 ring-primary ring-offset-2',
                answered
                  ? 'bg-success text-white'
                  : 'bg-white border border-border text-text-secondary hover:border-primary/40',
              )}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-6 space-y-2 text-xs font-semibold text-text-secondary">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-md bg-success" />
          Javob berildi ({Object.values(answers).filter(Boolean).length})
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-md border border-border bg-white" />
          Javob berilmagan ({questions.length - Object.values(answers).filter(Boolean).length})
        </div>
      </div>
    </aside>
  );
}
```

### 5.3 Visual timer (rang o'zgarishi bilan)

```tsx
function TimerWidget({ remaining, total }: { remaining: number | null; total: number }) {
  if (remaining === null) return null;

  const percentage = total > 0 ? (remaining / total) * 100 : 100;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const color = percentage > 50
    ? 'text-success'
    : percentage > 20
    ? 'text-warning'
    : 'text-danger animate-pulse';

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-2xl border px-5 py-3 font-mono text-2xl font-black transition-colors',
      percentage > 50 ? 'border-success/20 bg-success/5' :
      percentage > 20 ? 'border-warning/20 bg-warning/5' :
      'border-danger/20 bg-danger/5',
      color
    )}>
      <Clock size={18} />
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}
```

### 5.4 Test natijasida konfetti (`TestResultPage.tsx`)

```bash
npm install canvas-confetti @types/canvas-confetti
```

```tsx
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

// TestResultPage ichida, natija ma'lumoti yuklanganida:
useEffect(() => {
  if (!data) return;
  const percentage = (data.attempt.score / data.attempt.max_score) * 100;
  if (percentage >= 60) {
    // Konfetti!
    const duration = 2500;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#4361EE', '#10B981', '#F59E0B'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#4361EE', '#10B981', '#F59E0B'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }
}, [data]);
```

---

## 6-QISM — Dashboard yaxshilash

### 6.1 Animatsion Hero (DashboardPage.tsx)

```tsx
// Hero sectionni boyiting:
<motion.section
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
  className="relative overflow-hidden rounded-[40px] bg-slate-950 px-8 py-10 text-white shadow-2xl lg:px-12 lg:py-14"
>
  {/* Animated gradient orb */}
  <div className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-primary/20 blur-[80px] animate-pulse" />
  <div className="pointer-events-none absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-secondary/15 blur-[60px] animate-pulse" />

  <div className="relative z-10">
    <p className="label-micro text-white/50">{data.hero.kicker}</p>
    <h2 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">{data.hero.title}</h2>
    <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-white/70">{data.hero.subtitle}</p>

    {/* Quick action chips */}
    <div className="mt-8 flex flex-wrap gap-3">
      <Link to="/courses" className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
        <BookOpen size={15} /> Kurslar
      </Link>
      <Link to="/tests" className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
        <FlaskConical size={15} /> Testlar
      </Link>
      <Link to="/grades" className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
        <BarChart3 size={15} /> Baholar
      </Link>
    </div>
  </div>
</motion.section>
```

### 6.2 Stat kartalarni animatsiya bilan

```tsx
// StatCard komponentini yangilang:
function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
  const isNumber = typeof value === 'number';
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 20px 40px -15px rgba(67, 97, 238, 0.18)' }}
      transition={{ duration: 0.25 }}
      className="card p-7"
    >
      {icon && (
        <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center mb-5', color || 'bg-primary/10 text-primary')}>
          {icon}
        </div>
      )}
      <p className="label-micro">{title}</p>
      <p className="mt-3 text-4xl font-black tracking-tight text-text-primary">
        {isNumber ? <AnimatedCounter value={value} /> : value}
      </p>
      <p className="mt-2 text-sm font-medium text-text-secondary">{subtitle}</p>
    </motion.div>
  );
}
```

---

## 7-QISM — Mobil bottom navigation

### 7.1 `design/src/components/layout/bottom-nav.tsx`

```tsx
import { BarChart3, BookOpen, FlaskConical, Home, MessageCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/src/lib/utils';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Bosh sahifa' },
  { path: '/courses', icon: BookOpen, label: 'Kurslar' },
  { path: '/tests', icon: FlaskConical, label: 'Testlar' },
  { path: '/grades', icon: BarChart3, label: 'Baholar' },
  { path: '/messages', icon: MessageCircle, label: 'Xabarlar' },
];

export function BottomNav({ unreadMessages }: { unreadMessages: number }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white/90 backdrop-blur-xl px-2 pb-safe lg:hidden">
      <div className="flex justify-around">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors',
                isActive ? 'text-primary' : 'text-text-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'relative rounded-2xl p-2 transition-colors',
                  isActive ? 'bg-primary/10' : ''
                )}>
                  <Icon size={20} />
                  {path === '/messages' && unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-black text-white">
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </span>
                  )}
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
```

`app-shell.tsx` da:
```tsx
// <main> pastida:
<BottomNav unreadMessages={unreadMessages} />
// <main> ga pastdan padding:
<main className="flex-1 px-6 py-8 pb-24 lg:pb-8 lg:px-8 lg:py-10">
```

---

## 8-QISM — Illustrated Empty States

### 8.1 `design/src/components/ui/empty-state.tsx`

```tsx
import { LucideIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-5 rounded-[32px] border-2 border-dashed border-border bg-slate-50/50 px-8 py-16 text-center',
      className
    )}>
      {/* Animated icon container */}
      <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-white shadow-premium">
        <div className="absolute inset-0 rounded-[28px] bg-primary/5 animate-pulse" />
        <Icon size={36} className="text-primary/60" />
      </div>

      <div className="max-w-sm">
        <h3 className="text-xl font-black text-text-primary">{title}</h3>
        <p className="mt-2 text-sm font-medium leading-7 text-text-secondary">{description}</p>
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className="btn btn-primary mt-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

Ishlatish:
```tsx
// Kurslar bo'sh bo'lganda:
<EmptyState
  icon={BookOpen}
  title="Hozircha kurslar yo'q"
  description="Siz hali hech qaysi kursga yozilmagansiz. Barcha kurslarni ko'rish uchun quyidagi tugmani bosing."
  action={{ label: "Kurslarni ko'rish", onClick: () => navigate('/courses') }}
/>
```

---

## 9-QISM — Command Palette (Ctrl+K)

### 9.1 `design/src/components/ui/command-palette.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import { Search, BookOpen, FlaskConical, User, Settings, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/src/lib/utils';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
}

export function CommandPalette({ courses }: { courses?: { id: number; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); }
    else { setQuery(''); setSelectedIndex(0); }
  }, [open]);

  const staticItems: CommandItem[] = [
    { id: 'dashboard', label: 'Bosh sahifa', icon: <Settings size={16} />, action: () => navigate('/'), keywords: ['home', 'bosh', 'dashboard'] },
    { id: 'courses', label: 'Kurslar', icon: <BookOpen size={16} />, action: () => navigate('/courses'), keywords: ['kurs', 'course'] },
    { id: 'tests', label: 'Testlar', icon: <FlaskConical size={16} />, action: () => navigate('/tests'), keywords: ['test', 'imtihon'] },
    { id: 'profile', label: 'Profil', icon: <User size={16} />, action: () => navigate('/profile'), keywords: ['profil', 'profile'] },
    ...(courses || []).map(c => ({
      id: `course-${c.id}`,
      label: c.title,
      description: 'Kursga o\'tish',
      icon: <BookOpen size={16} className="text-primary" />,
      action: () => navigate(`/courses/${c.id}`),
      keywords: c.title.toLowerCase().split(' '),
    })),
  ];

  const filtered = query.trim()
    ? staticItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.keywords.some(k => k.includes(query.toLowerCase()))
      )
    : staticItems.slice(0, 6);

  function handleSelect(item: CommandItem) {
    item.action();
    setOpen(false);
  }

  return (
    <>
      {/* Trigger hint in header */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 rounded-2xl border border-border bg-white/70 px-4 py-2.5 text-sm font-medium text-text-muted shadow-sm hover:text-text-primary transition-colors"
      >
        <Search size={15} />
        <span>Qidirish...</span>
        <kbd className="ml-2 rounded-lg border border-border bg-slate-100 px-2 py-0.5 text-[10px] font-black">⌘K</kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh] px-4 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-lg overflow-hidden rounded-[28px] border border-border bg-white shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <Search size={18} className="text-text-muted flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                  placeholder="Sahifa, kurs yoki buyruq qidiring..."
                  className="flex-1 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
                  onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
                    if (e.key === 'Enter' && filtered[selectedIndex]) handleSelect(filtered[selectedIndex]);
                  }}
                />
                <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary">
                  <X size={16} />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto p-2">
                {filtered.length === 0 && (
                  <p className="py-8 text-center text-sm text-text-muted">Natija topilmadi</p>
                )}
                {filtered.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors',
                      idx === selectedIndex ? 'bg-primary/8 text-primary' : 'text-text-secondary hover:bg-slate-50',
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-xl',
                      idx === selectedIndex ? 'bg-primary/10' : 'bg-slate-100'
                    )}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary">{item.label}</p>
                      {item.description && <p className="text-xs text-text-muted">{item.description}</p>}
                    </div>
                    {idx === selectedIndex && (
                      <kbd className="ml-auto text-[10px] font-black text-text-muted">↵</kbd>
                    )}
                  </button>
                ))}
              </div>

              <div className="border-t border-border px-5 py-3 flex gap-4 text-[10px] font-bold text-text-muted">
                <span>↑↓ harakat</span>
                <span>↵ ochish</span>
                <span>Esc yopish</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

---

## 10-QISM — Drag-Drop fayl yuklash

### 10.1 `design/src/components/ui/dropzone.tsx`

```tsx
import { useCallback, useState } from 'react';
import { Upload, FileCheck2, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface DropzoneProps {
  onFile: (file: File) => void;
  accept?: string;
  maxMb?: number;
  label?: string;
}

export function Dropzone({ onFile, accept = '*/*', maxMb = 50, label = 'Fayl tanlang yoki bu yerga tashlang' }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Fayl hajmi ${maxMb}MB dan oshmasligi kerak.`);
      return;
    }
    setError(null);
    setSelectedFile(file);
    onFile(file);
  }, [maxMb, onFile]);

  return (
    <div>
      <label
        className={cn(
          'flex flex-col items-center justify-center gap-4 rounded-[24px] border-2 border-dashed p-8 text-center cursor-pointer transition-all',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border bg-slate-50/50 hover:border-primary/40 hover:bg-primary/3',
          selectedFile ? 'border-success/40 bg-success/5' : '',
        )}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {selectedFile ? (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-success/10 text-success">
              <FileCheck2 size={32} />
            </div>
            <div>
              <p className="text-sm font-black text-text-primary">{selectedFile.name}</p>
              <p className="mt-1 text-xs text-text-muted">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </>
        ) : (
          <>
            <div className={cn(
              'flex h-16 w-16 items-center justify-center rounded-[20px] transition-colors',
              isDragging ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-text-muted'
            )}>
              <Upload size={30} />
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary">{label}</p>
              <p className="mt-1 text-xs text-text-muted">Maksimal hajm: {maxMb} MB</p>
            </div>
          </>
        )}
      </label>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-danger">
          <X size={12} /> {error}
        </p>
      )}
    </div>
  );
}
```

---

## 11-QISM — Gradebook va baho sahifalari uchun charts

```bash
npm install recharts
```

### 11.1 Progress chart komponenti

```tsx
// design/src/components/ui/progress-chart.tsx
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';

export function CircularProgress({ value, max, label }: { value: number; max: number; label: string }) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  const data = [{ value: percentage, fill: percentage >= 60 ? '#10B981' : percentage >= 40 ? '#F59E0B' : '#EF4444' }];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-28 w-28">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar dataKey="value" cornerRadius={10} background={{ fill: '#F1F5F9' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-text-primary">{percentage}%</span>
        </div>
      </div>
      <p className="text-xs font-bold text-text-muted">{label}</p>
    </div>
  );
}
```

---

## 12-QISM — Notifications sahifasini boyitish

```tsx
// NotificationsPage.tsx — Notification item komponentini yangilang:

const NOTIF_ICONS: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  assignment: { icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
  test: { icon: FlaskConical, color: 'text-purple-600', bg: 'bg-purple-50' },
  grade: { icon: BarChart3, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  message: { icon: MessageCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
  default: { icon: Bell, color: 'text-slate-600', bg: 'bg-slate-100' },
};

function NotifItem({ notif, onRead }: { notif: Notification; onRead: () => void }) {
  const type = notif.title.toLowerCase().includes('test') ? 'test'
    : notif.title.toLowerCase().includes('vazifa') ? 'assignment'
    : notif.title.toLowerCase().includes('baho') ? 'grade'
    : notif.title.toLowerCase().includes('xabar') ? 'message'
    : 'default';

  const { icon: Icon, color, bg } = NOTIF_ICONS[type] ?? NOTIF_ICONS.default;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-start gap-4 rounded-[24px] p-5 transition-colors',
        notif.is_read ? 'bg-white border border-border' : 'bg-primary/4 border border-primary/15',
      )}
    >
      <div className={cn('flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px]', bg)}>
        <Icon size={22} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-black', notif.is_read ? 'text-text-secondary' : 'text-text-primary')}>
          {notif.title}
        </p>
        <p className="mt-1 text-sm text-text-secondary leading-6">{notif.message}</p>
        <p className="mt-2 text-xs text-text-muted">{formatDateTime(notif.created_at)}</p>
      </div>
      {!notif.is_read && (
        <button onClick={onRead} className="flex-shrink-0 text-primary hover:text-primary-hover">
          <MailOpen size={18} />
        </button>
      )}
    </motion.div>
  );
}
```

---

## Tekshirish ro'yxati (QA Checklist)

### Dizayn
- [ ] Dark mode ishlaydi (localStorage'da saqlangan)
- [ ] ThemeToggle 3 holat: light / dark / system
- [ ] Barcha `.card`, `.btn`, `.input` dark modeda to'g'ri ko'rinadi

### Animatsiyalar
- [ ] Sahifalar orasida o'tish animatsiyasi (framer-motion)
- [ ] Stat counter raqamlar animatsiya bilan oshadi
- [ ] Kurs kartalar stagger effekti bilan paydo bo'ladi
- [ ] Hover holati barcha kartarda ishlaydi

### Toast
- [ ] `useToast().success(...)` call qilib ko'rsating
- [ ] `useToast().error(...)` 6 sekund ko'rinib yo'qoladi
- [ ] Bir vaqtda bir nechta toast stack ko'rsatiladi

### Test sahifasi
- [ ] Full-screen rejim (`fixed inset-0`)
- [ ] Question navigator 5x grid ko'rsatiladi
- [ ] Javob berilgan savollar yashil rangda
- [ ] Timer range bo'yicha rang o'zgaradi
- [ ] Keyingi/Oldingi savolga o'tish animatsiyali
- [ ] Test natijasida konfetti o'ynaydi (ball ≥ 60%)

### Mobil
- [ ] Bottom nav faqat mobile'da ko'rinadi (`lg:hidden`)
- [ ] `pb-safe` iOS safe area ishlab turadi
- [ ] Unread message badge bottom navda ko'rinadi

### Command palette
- [ ] Ctrl+K / Cmd+K ochadi
- [ ] Esc yopadi
- [ ] Arrow keys navigatsiya qiladi
- [ ] Enter tanlaydi
- [ ] Kurs nomlari qidiruv natijasida chiqadi

### Empty states
- [ ] Kurslar bo'sh bo'lganda `EmptyState` ko'rinadi
- [ ] Bildirishnomalar bo'sh bo'lganda ko'rinadi
- [ ] Action tugmasi to'g'ri sahifaga olib ketadi

### Dropzone
- [ ] Drag-over holati rangli border ko'rsatadi
- [ ] Fayl tanlanganda nomi va hajm ko'rinadi
- [ ] Hajm limiti ishlab turadi (xato xabari chiqadi)

### Accessibility
- [ ] Barcha tugmalar `aria-label` atributiga ega
- [ ] Keyboard navigatsiya modal ichida trap qilindi
- [ ] Focus ring barcha interaktiv elementlarda ko'rinadi

---

## O'rnatish buyruqlari

```bash
cd design

# Framer Motion (animatsiyalar)
npm install framer-motion

# Recharts (grafik)
npm install recharts

# Konfetti (test natijasi)
npm install canvas-confetti @types/canvas-confetti

# Build tekshirish
npm run build
```
