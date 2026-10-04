import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isOnline } from '@/lib/network';
import { secureStorage } from '@/lib/storage';
import { createStore } from '@/lib/store';

import type { TokenPair } from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const extra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (extra) return extra.replace(/\/+$/, '');
  // Android emulators reach the host machine at 10.0.2.2.
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

export const API_ORIGIN = resolveBaseUrl();
export const API_BASE = `${API_ORIGIN}/api/v1`;

/** Cold starts on free hosting can take close to a minute. */
const REQUEST_TIMEOUT_MS = 70_000;
const WAKING_THRESHOLD_MS = 3_500;
const RETRY_WINDOW_MS = 75_000;
const RETRY_DELAY_MS = 3_000;
const RETRYABLE_STATUS = new Set([502, 503, 504]);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ApiErrorKind = 'offline' | 'network' | 'timeout' | 'http';

export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isAuth() {
    return this.status === 401;
  }
}

/** Understands both `{error:{code,message}}` and FastAPI's `{detail: string | [{msg}]}`. */
function parseErrorBody(body: unknown, fallback: string): { message: string; code?: string } {
  if (body && typeof body === 'object') {
    const b = body as Record<string, any>;
    if (b.error && typeof b.error === 'object') {
      return { message: String(b.error.message ?? fallback), code: b.error.code };
    }
    if (typeof b.detail === 'string') return { message: b.detail };
    if (Array.isArray(b.detail) && b.detail[0]?.msg) {
      return { message: String(b.detail[0].msg), code: 'validation_error' };
    }
  }
  return { message: fallback };
}

// ---------------------------------------------------------------------------
// "Waking up the server" detection
// ---------------------------------------------------------------------------

export const serverStatus = createStore<{ waking: boolean; since: number | null }>({
  waking: false,
  since: null,
});

// ---------------------------------------------------------------------------
// Token storage (iOS Keychain / Android Keystore)
// ---------------------------------------------------------------------------

const ACCESS_KEY = 'rolenest.access_token';
const REFRESH_KEY = 'rolenest.refresh_token';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let tokensLoaded = false;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

export async function loadTokens() {
  if (tokensLoaded) return;
  accessToken = await secureStorage.get(ACCESS_KEY);
  refreshToken = await secureStorage.get(REFRESH_KEY);
  tokensLoaded = true;
}

export async function saveTokens(pair: TokenPair) {
  accessToken = pair.access_token;
  refreshToken = pair.refresh_token;
  tokensLoaded = true;
  await secureStorage.set(ACCESS_KEY, pair.access_token);
  await secureStorage.set(REFRESH_KEY, pair.refresh_token);
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await secureStorage.remove(ACCESS_KEY);
  await secureStorage.remove(REFRESH_KEY);
}

export const hasStoredSession = () => !!refreshToken || !!accessToken;
export const getRefreshToken = () => refreshToken;

// ---------------------------------------------------------------------------
// Request core
// ---------------------------------------------------------------------------

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the bearer token (default true). */
  auth?: boolean;
  timeoutMs?: number;
  /** Internal: already retried after a token refresh. */
  _retried?: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (!refreshToken) return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await rawFetch('/auth/refresh', {
          method: 'POST',
          body: { refresh_token: refreshToken },
          auth: false,
        });
        await saveTokens(res as TokenPair);
        return true;
      } catch (e) {
        // Only a definitive rejection ends the session; network trouble does not.
        if (
          e instanceof ApiError &&
          e.kind === 'http' &&
          (e.status === 401 || e.status === 403 || e.status === 400)
        ) {
          await clearTokens();
          onSessionExpired?.();
        }
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function rawFetch(path: string, opts: RequestOptions): Promise<unknown> {
  if (!isOnline()) {
    throw new ApiError('offline', 'You are offline.');
  }
  if (!tokensLoaded) await loadTokens();

  const started = Date.now();
  let wakingTimer: ReturnType<typeof setTimeout> | undefined;

  const markWaking = () =>
    serverStatus.set({ waking: true, since: serverStatus.get().since ?? Date.now() });
  const clearWaking = () => {
    if (wakingTimer) clearTimeout(wakingTimer);
    if (serverStatus.get().waking) serverStatus.set({ waking: false, since: null });
  };

  try {
    while (true) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? REQUEST_TIMEOUT_MS);
      wakingTimer = setTimeout(markWaking, WAKING_THRESHOLD_MS);

      const headers: Record<string, string> = { Accept: 'application/json' };
      // FormData sets its own multipart boundary, so only JSON bodies get a Content-Type here.
      const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
      if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
      if (opts.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

      let res: Response | null = null;
      let networkFailure = false;
      let aborted = false;
      try {
        res = await fetch(`${API_BASE}${path}`, {
          method: opts.method ?? 'GET',
          headers,
          body: isForm
            ? (opts.body as FormData)
            : opts.body !== undefined
              ? JSON.stringify(opts.body)
              : undefined,
          signal: controller.signal,
        });
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') aborted = true;
        else networkFailure = true;
      } finally {
        clearTimeout(timeout);
        clearTimeout(wakingTimer);
      }

      const retryable = networkFailure || (res !== null && RETRYABLE_STATUS.has(res.status));
      if (retryable && Date.now() - started < RETRY_WINDOW_MS && isOnline()) {
        // The host is likely still starting. Keep the "waking up" banner and try again.
        markWaking();
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      if (aborted) throw new ApiError('timeout', 'The server took too long to respond.');
      if (networkFailure || !res) throw new ApiError('network', 'Could not reach the server.');

      clearWaking();

      let data: unknown = null;
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }
      if (!res.ok) {
        const { message, code } = parseErrorBody(data, `Request failed (${res.status})`);
        throw new ApiError('http', message, res.status, code);
      }
      return data;
    }
  } finally {
    clearWaking();
  }
}

/** Typed JSON request with bearer token + one transparent refresh on 401. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  try {
    return (await rawFetch(path, opts)) as T;
  } catch (e) {
    if (
      e instanceof ApiError &&
      e.status === 401 &&
      opts.auth !== false &&
      !opts._retried &&
      refreshToken
    ) {
      const ok = await refreshTokens();
      if (ok) return request<T>(path, { ...opts, _retried: true });
    }
    throw e;
  }
}
