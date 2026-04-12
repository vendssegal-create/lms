import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchSession, loginRequest, logoutRequest, switchRoleRequest } from '@/src/api/auth';
import { AuthSession, LoginPayload } from '@/src/types';

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
  refreshSession: (options?: { silent?: boolean }) => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (roleName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const EMPTY_SESSION: AuthSession = {
  authenticated: false,
  user: null,
  active_role: null,
  available_roles: [],
  navigation: [],
  notifications: { unread_count: 0 },
  messages: { unread_count: 0 },
  urls: {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const nextSession = await fetchSession();
      setSession(nextSession);
    } catch (err) {
      setSession(EMPTY_SESSION);
      setError(err instanceof Error ? err.message : 'Sessiya yuklanmadi.');
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (payload: LoginPayload) => {
    setError(null);
    const response = await loginRequest(payload);
    setSession(response.session);
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    await logoutRequest();
    setSession(EMPTY_SESSION);
  }, []);

  const switchRole = useCallback(async (roleName: string) => {
    setError(null);
    const response = await switchRoleRequest(roleName);
    setSession(response.session);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isLoading,
    error,
    refreshSession,
    login,
    logout,
    switchRole,
  }), [session, isLoading, error, refreshSession, login, logout, switchRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
