import type { ApiErrorBody } from '../types/api';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!rawBaseUrl && import.meta.env.DEV) {
  console.warn(
    '[api] VITE_API_BASE_URL não definida. Copie .env.example para .env. ' +
      'Lembre-se de que o Vite só expõe variáveis com o prefixo VITE_.',
  );
}

export const API_BASE_URL = (rawBaseUrl ?? 'http://localhost:3004/api').replace(/\/+$/, '');

const TOKEN_STORAGE_KEY = 'pi6.auth.token';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isAuthExpired(): boolean {
    return this.status === 401;
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token === null) localStorage.removeItem(TOKEN_STORAGE_KEY);
    else localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
  }
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  skipAuthRedirect?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_BASE_URL}/${path.replace(/^\/+/, '')}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, skipAuthRedirect } = options;
  const token = getStoredToken();

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Não foi possível se conectar ao servidor. Verifique sua conexão ou se a API está no ar.',
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? safeParse(text) : null;

  if (!response.ok) {
    const errorBody = (payload ?? {}) as Partial<ApiErrorBody>;

    if (response.status === 401 && !skipAuthRedirect) {
      for (const listener of unauthorizedListeners) listener();
    }

    throw new ApiError(
      response.status,
      errorBody.error ?? `HTTP_${response.status}`,
      errorBody.message ?? 'Não foi possível concluir a operação.',
      errorBody.details,
    );
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
