import type { ReactNode } from 'react';
import { AuthProvider } from '@/src/features/auth/auth-context';
import { ToastProvider } from '@/src/components/notifications/ToastProvider';
import { ThemeProvider } from '@/src/features/theme/theme-context';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
