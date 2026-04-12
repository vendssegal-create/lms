import { apiRequest } from '@/src/api/client';
import { PasswordChangeResponse, ProfileResponse, ProfileUpdateResponse } from '@/src/types';

export function fetchProfile() {
  return apiRequest<ProfileResponse>('/api/auth/profile/');
}

export function updateProfile(payload: FormData) {
  return apiRequest<ProfileUpdateResponse>('/api/auth/profile/update/', {
    method: 'POST',
    body: payload,
  });
}

export function changePassword(payload: URLSearchParams) {
  return apiRequest<PasswordChangeResponse>('/api/auth/change-password/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: payload.toString(),
  });
}
