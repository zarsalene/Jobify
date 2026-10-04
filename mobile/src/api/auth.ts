import { clearTokens, getRefreshToken, request, saveTokens } from './client';
import type { LoginRequest, RegisterRequest, TokenPair, UserRead } from './types';

/** REAL auth - talks to the FastAPI backend (/api/v1/auth/* and /api/v1/users/me). */
export const authApi = {
  async register(body: RegisterRequest): Promise<TokenPair> {
    const pair = await request<TokenPair>('/auth/register', { method: 'POST', body, auth: false });
    await saveTokens(pair);
    return pair;
  },
  async login(body: LoginRequest): Promise<TokenPair> {
    const pair = await request<TokenPair>('/auth/login', { method: 'POST', body, auth: false });
    await saveTokens(pair);
    return pair;
  },
  me(): Promise<UserRead> {
    return request<UserRead>('/users/me');
  },
  async logout(): Promise<void> {
    const refresh_token = getRefreshToken();
    try {
      if (refresh_token) {
        await request<void>('/auth/logout', {
          method: 'POST',
          body: { refresh_token },
          auth: false,
          timeoutMs: 8000,
        });
      }
    } catch {
      /* best effort - we still clear local tokens */
    } finally {
      await clearTokens();
    }
  },
};
