import { AuthSession, LoginPayload, QuickChatPreferences } from '@/src/types';
import { apiRequest, jsonRequest } from '@/src/api/client';

interface LoginResponse {
  success: boolean;
  session: AuthSession;
}

interface LogoutResponse {
  success: boolean;
}

interface SwitchRoleResponse {
  success: boolean;
  session: AuthSession;
}

interface QuickChatPreferencesResponse {
  success: boolean;
  quick_chat: QuickChatPreferences;
  session: AuthSession;
}

export function fetchSession() {
  return apiRequest<AuthSession>('/api/auth/session/');
}

export function loginRequest(payload: LoginPayload) {
  return jsonRequest<LoginResponse>('/api/auth/login/', 'POST', payload);
}

export function logoutRequest() {
  return jsonRequest<LogoutResponse>('/api/auth/logout/', 'POST');
}

export function switchRoleRequest(roleName: string) {
  return jsonRequest<SwitchRoleResponse>(`/api/auth/switch-role/${encodeURIComponent(roleName)}/`, 'POST');
}

export function saveQuickChatPreferences(payload: QuickChatPreferences) {
  return jsonRequest<QuickChatPreferencesResponse>('/api/auth/quick-chat/preferences/', 'POST', payload);
}
