import type { LoginResponse, MeResponse, Problem } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly payload: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  for (const listener of listeners) listener(token);
}

export function onTokenChange(listener: (token: string | null) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type RefreshResponse = { accessToken: string; expiresIn: number };

let refreshing: Promise<RefreshResponse | null> | null = null;

/**
 * Refresh single-flight. Refresh token ada di cookie HttpOnly, jadi JS tidak
 * pernah melihatnya. Response refresh hanya berisi token — profil diambil
 * terpisah lewat `/auth/me`.
 */
export function refreshSession(): Promise<RefreshResponse | null> {
  refreshing ??= (async () => {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-client': 'web' },
      body: '{}',
    });

    if (!response.ok) {
      setAccessToken(null);
      return null;
    }

    const data = (await response.json()) as RefreshResponse;
    setAccessToken(data.accessToken);
    return data;
  })().finally(() => {
    refreshing = null;
  });

  return refreshing;
}

function queryString(query?: Record<string, string | number | boolean | undefined | null>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const result = params.toString();
  return result ? `?${result}` : '';
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Problem & Record<string, unknown>;
    return new ApiError(
      response.status,
      body.code ?? 'unknown',
      body.detail ?? body.title ?? 'Gagal',
      body as Record<string, unknown>,
    );
  } catch {
    return new ApiError(response.status, 'unknown', `Permintaan gagal (${response.status})`);
  }
}

async function send(
  path: string,
  init: { method: string; body?: unknown; form?: FormData; query?: Record<string, string | number | boolean | undefined | null> },
  retry = true,
): Promise<Response> {
  const headers: Record<string, string> = { 'x-client': 'web' };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  if (init.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`/api/v1/${path}${queryString(init.query)}`, {
    method: init.method,
    credentials: 'include',
    headers,
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });

  if (response.status === 401 && retry) {
    const session = await refreshSession();
    if (session) return send(path, init, false);
  }

  if (!response.ok) throw await parseError(response);
  return response;
}

async function json<T>(path: string, init: Parameters<typeof send>[1]): Promise<T> {
  const response = await send(path, init);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, string | number | boolean | undefined | null>) =>
    json<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => json<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => json<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => json<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => json<T>(path, { method: 'POST', form }),
};

export async function login(phone: string, password: string, communityId?: string): Promise<LoginResponse> {
  const data = await json<LoginResponse>('auth/login', {
    method: 'POST',
    body: { phone, password, communityId },
  });
  setAccessToken(data.accessToken);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-client': 'web', 'content-type': 'application/json' },
      body: '{}',
    });
  } finally {
    setAccessToken(null);
  }
}

export async function fetchMe(): Promise<MeResponse> {
  return api.get<MeResponse>('auth/me');
}

export async function fetchProtectedMedia(mediaId: string): Promise<Blob> {
  const response = await send(`media/${mediaId}/raw`, { method: 'GET' });
  return response.blob();
}
