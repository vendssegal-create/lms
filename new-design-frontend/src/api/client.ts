const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};
const DEFAULT_TIMEOUT_MS = 15000;
const requestCache = new Map<string, {
  expiresAt: number;
  data?: unknown;
  promise?: Promise<unknown>;
}>();

export type RequestCacheMode = 'default' | 'reload' | 'bypass';

function getCookie(name: string): string {
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return '';
}

async function ensureCsrfCookie() {
  if (getCookie('csrftoken')) {
    return getCookie('csrftoken');
  }

  await fetch('/api/auth/session/', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: JSON_HEADERS.Accept },
  });

  return getCookie('csrftoken');
}

export async function apiRequest<T>(input: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', JSON_HEADERS.Accept);
  }

  const method = (init.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && !headers.has('X-CSRFToken')) {
    const csrfToken = await ensureCsrfCookie();
    if (csrfToken) {
      headers.set('X-CSRFToken', csrfToken);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const signal = init.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal;

  try {
    const response = await fetch(input, {
      credentials: 'include',
      ...init,
      headers,
      signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json() : null;
    const textPayload = isJson ? '' : await response.text();

    if (!response.ok) {
      if (response.status === 403 && textPayload.includes('CSRF')) {
        throw new Error('CSRF cookie topilmadi. Sahifani yangilang va qayta urinib ko\'ring.');
      }
      const message = payload && typeof payload.error === 'string'
        ? payload.error
        : 'So\'rov bajarilmadi.';
      throw new Error(message);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Server javobi kutish vaqtidan oshdi.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function jsonRequest<T>(input: string, method: string, body?: unknown): Promise<T> {
  return apiRequest<T>(input, {
    method,
    headers: JSON_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function invalidateApiCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    requestCache.clear();
    return;
  }

  for (const key of requestCache.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      requestCache.delete(key);
    }
  }
}

export function cachedApiRequest<T>(
  cacheKey: string,
  input: string,
  init: RequestInit = {},
  ttlMs = 15000,
  cacheMode: RequestCacheMode = 'default',
): Promise<T> {
  if (cacheMode === 'bypass') {
    return apiRequest<T>(input, init);
  }

  if (cacheMode === 'reload') {
    requestCache.delete(cacheKey);
  }

  const now = Date.now();
  const existing = requestCache.get(cacheKey);
  if (existing && existing.data !== undefined && existing.expiresAt > now) {
    return Promise.resolve(existing.data as T);
  }
  if (existing?.promise) {
    return existing.promise as Promise<T>;
  }

  const promise = apiRequest<T>(input, init)
    .then((data) => {
      requestCache.set(cacheKey, {
        data,
        expiresAt: Date.now() + ttlMs,
      });
      return data;
    })
    .catch((error) => {
      requestCache.delete(cacheKey);
      throw error;
    });

  requestCache.set(cacheKey, {
    expiresAt: now + ttlMs,
    promise,
  });

  return promise;
}
