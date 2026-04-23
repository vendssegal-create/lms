import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { uz } from '@/src/locales/uz';
import { ru } from '@/src/locales/ru';
import { en } from '@/src/locales/en';
import type { Translations } from '@/src/locales/uz';

export type Lang = 'uz' | 'ru' | 'en';

const LOCALES: Record<Lang, Translations> = { uz, ru, en };
const LANG_KEY = 'lms.lang';

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | null>(null);

function detectBrowserLang(): Lang {
  const saved = localStorage.getItem(LANG_KEY) as Lang | null;
  if (saved && ['uz', 'ru', 'en'].includes(saved)) return saved;
  const browserLang = navigator.language.slice(0, 2);
  if (browserLang === 'ru') return 'ru';
  if (browserLang === 'en') return 'en';
  return 'uz';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'uz';
    return detectBrowserLang();
  });

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem(LANG_KEY, newLang);
    document.documentElement.lang =
      newLang === 'uz' ? 'uz-UZ' : newLang === 'ru' ? 'ru-RU' : 'en-US';
  };

  useEffect(() => {
    document.documentElement.lang =
      lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US';
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t: LOCALES[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
