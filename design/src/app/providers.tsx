import type { ReactNode } from 'react';
import { AuthProvider } from '@/src/features/auth/auth-context';
import { ToastProvider } from '@/src/components/notifications/ToastProvider';
import { ThemeProvider } from '@/src/features/theme/theme-context';
import { I18nProvider } from '@/src/features/i18n/i18n-context';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
