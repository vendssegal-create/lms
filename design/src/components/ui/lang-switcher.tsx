import { Globe } from 'lucide-react';
import { useI18n, type Lang } from '@/src/features/i18n/i18n-context';
import { cn } from '@/src/lib/utils';

const LANG_OPTIONS: { value: Lang; label: string; flag: string; short: string }[] = [
  { value: 'uz', label: "O'zbek", flag: '🇺🇿', short: 'UZ' },
  { value: 'ru', label: 'Русский', flag: '🇷🇺', short: 'RU' },
  { value: 'en', label: 'English', flag: '🇬🇧', short: 'EN' },
];

export function LangSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-2xl border border-border bg-card p-1 shadow-premium',
        className,
      )}
      title="Language / Til / Язык"
      aria-label="Language switcher"
    >
      <Globe size={14} className="ml-1.5 shrink-0 text-text-muted" />
      {LANG_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLang(option.value)}
          title={option.label}
          aria-label={option.label}
          aria-pressed={lang === option.value}
          className={cn(
            'rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            lang === option.value
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          <span className="mr-0.5">{option.flag}</span>
          {option.short}
        </button>
      ))}
    </div>
  );
}

/** Compact version — only flags, no text labels */
export function LangSwitcherCompact({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();

  return (
    <div
      className={cn('flex items-center gap-0.5 rounded-xl border border-border bg-card p-0.5', className)}
      aria-label="Language switcher"
    >
      {LANG_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLang(option.value)}
          title={option.label}
          aria-label={option.label}
          aria-pressed={lang === option.value}
          className={cn(
            'h-7 w-7 rounded-lg text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            lang === option.value
              ? 'bg-primary shadow-sm'
              : 'hover:bg-primary/5',
          )}
        >
          {option.flag}
        </button>
      ))}
    </div>
  );
}
