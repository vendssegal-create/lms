import { apiRequest, cachedApiRequest, invalidateApiCache, type RequestCacheMode } from '@/src/api/client';
import type { MessagesThreadDetailResponse, MessagesThreadMessage, MessagesThreadsListResponse } from '@/src/types';

const THREADS_CACHE_KEY = 'messages:threads';
const CONTACTS_CACHE_PREFIX = 'messages:contacts:';
const THREAD_DETAIL_CACHE_PREFIX = 'messages:thread-detail:';
const MESSAGE_CACHE_TTL_MS = 20000;

type FetchOptions = {
  cacheMode?: RequestCacheMode;
};

export function fetchThreads(options: FetchOptions = {}) {
  return cachedApiRequest<MessagesThreadsListResponse>(
    THREADS_CACHE_KEY,
    '/api/messages/threads/',
    {},
    MESSAGE_CACHE_TTL_MS,
    options.cacheMode,
  );
}

export function fetchContacts(role = '', options: FetchOptions = {}) {
  const qs = new URLSearchParams();
  if (role) qs.set('role', role);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return cachedApiRequest<{ items: Array<{ id: number; username: string; full_name: string; avatar_url: string }> }>(
    `${CONTACTS_CACHE_PREFIX}${role || 'all'}`,
    `/api/messages/contacts/${suffix}`,
    {},
    MESSAGE_CACHE_TTL_MS,
    options.cacheMode,
  );
}

export function searchUsers(query: string, role = '') {
  const qs = new URLSearchParams();
  qs.set('q', query);
  if (role) qs.set('role', role);
  return apiRequest<{ items: Array<{ id: number; username: string; full_name: string; avatar_url: string }> }>(
    `/api/messages/users/search/?${qs.toString()}`
  );
}

export function startThread(payload: { username?: string; user_id?: number }) {
  return apiRequest<{ success: boolean; thread: { id: number; other_user: { id: number; username: string; full_name: string; avatar_url: string } } }>(
    '/api/messages/threads/start/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    }
  ).then((response) => {
    invalidateMessagesCache();
    return response;
  });
}

export function fetchThreadDetail(threadId: number, limit = 50, beforeId?: number, options: FetchOptions = {}) {
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  if (beforeId) qs.set('before_id', String(beforeId));
  if (beforeId) {
    return apiRequest<MessagesThreadDetailResponse>(`/api/messages/threads/${threadId}/?${qs.toString()}`);
  }
  return cachedApiRequest<MessagesThreadDetailResponse>(
    `${THREAD_DETAIL_CACHE_PREFIX}${threadId}:limit:${limit}`,
    `/api/messages/threads/${threadId}/?${qs.toString()}`,
    {},
    MESSAGE_CACHE_TTL_MS,
    options.cacheMode,
  );
}

export function sendThreadMessage(threadId: number, payload: { body: string; reply_to_id?: number | null }) {
  return apiRequest<{ success: boolean; message: MessagesThreadMessage }>(
    `/api/messages/threads/${threadId}/send/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    }
  ).then((response) => {
    invalidateMessageThreadCache(threadId);
    return response;
  });
}

export function sendThreadAttachment(threadId: number, payload: { body?: string; file: File; reply_to_id?: number }) {
  const fd = new FormData();
  if (payload.body) fd.set('body', payload.body);
  if (payload.reply_to_id) fd.set('reply_to_id', String(payload.reply_to_id));
  fd.set('file', payload.file);
  return apiRequest<{ success: boolean; message: MessagesThreadMessage }>(
    `/api/messages/threads/${threadId}/send/`,
    {
      method: 'POST',
      body: fd,
    }
  ).then((response) => {
    invalidateMessageThreadCache(threadId);
    return response;
  });
}

export function deleteMessage(messageId: number) {
  return apiRequest<{ success: boolean }>(
    `/api/messages/messages/${messageId}/delete/`,
    { method: 'POST' },
  );
}

export function reactToMessage(messageId: number, emoji: string) {
  return apiRequest<{ success: boolean; action: string; reactions: Record<string, number> }>(
    `/api/messages/messages/${messageId}/react/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    },
  );
}

export function searchThreadMessages(threadId: number, query: string) {
  return apiRequest<{ items: MessagesThreadMessage[] }>(
    `/api/messages/threads/${threadId}/search/?q=${encodeURIComponent(query)}`,
  );
}

export function markThreadRead(threadId: number) {
  return apiRequest<{ success: boolean }>(`/api/messages/threads/${threadId}/read/`, { method: 'POST' }).then((response) => {
    invalidateApiCache(THREADS_CACHE_KEY);
    invalidateApiCache(`${THREAD_DETAIL_CACHE_PREFIX}${threadId}`);
    return response;
  });
}

export function invalidateMessagesCache() {
  invalidateApiCache(THREADS_CACHE_KEY);
  invalidateApiCache(CONTACTS_CACHE_PREFIX);
  invalidateApiCache(THREAD_DETAIL_CACHE_PREFIX);
}

export function invalidateMessageThreadCache(threadId: number) {
  invalidateApiCache(THREADS_CACHE_KEY);
  invalidateApiCache(`${THREAD_DETAIL_CACHE_PREFIX}${threadId}`);
}

export async function prefetchMessagesOverview(role = '') {
  await Promise.all([
    fetchThreads(),
    fetchContacts(role),
  ]);
}

export function prefetchThreadDetail(threadId: number, limit = 80) {
  return fetchThreadDetail(threadId, limit);
}
