import { ApiError, authApi, type LoginRequest, type RegisterRequest, type UserRead } from '@/api';
import { clearTokens, hasStoredSession, loadTokens, setSessionExpiredHandler } from '@/api/client';
import { createStore } from '@/lib/store';
import { storage } from '@/lib/storage';

import { resetAssistant } from './assistant';
import { resetCvParser } from './cvParser';
import { resetData } from './data';
import { resetNotifications } from './notifications';
import { refreshProfileFromServer, resetProfile } from './profile';

export interface SessionState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: UserRead | null;
}

export const session = createStore<SessionState>({ status: 'loading', user: null });

const USER_KEY = 'rolenest.user.v1';

async function setSignedIn(user: UserRead) {
  session.set({ status: 'signedIn', user });
  await storage.setJSON(USER_KEY, user);
  void refreshProfileFromServer();
}

/** Called once at launch: restore the session from the keychain without blocking on the network. */
export async function bootstrapSession() {
  setSessionExpiredHandler(() => {
    void signOutLocal();
  });
  await loadTokens();
  if (!hasStoredSession()) {
    session.set({ status: 'signedOut', user: null });
    return;
  }
  const cached = await storage.getJSON<UserRead>(USER_KEY);
  session.set({ status: 'signedIn', user: cached });
  // Verify in the background. Offline or a slow server must not log the user out.
  authApi
    .me()
    .then((u) => setSignedIn(u))
    .catch(() => {
      /* handled by the session-expired callback when a refresh is definitively rejected */
    });
}

export async function signUp(input: RegisterRequest) {
  await authApi.register(input);
  const user = await authApi.me().catch(
    () => ({ id: '', email: input.email, full_name: input.full_name }) as UserRead,
  );
  await setSignedIn(user);
}

export async function logIn(input: LoginRequest) {
  await authApi.login(input);
  const user = await authApi.me().catch(
    () => ({ id: '', email: input.email, full_name: input.email.split('@')[0] }) as UserRead,
  );
  await setSignedIn(user);
}

async function signOutLocal() {
  await clearTokens();
  await storage.remove(USER_KEY);
  resetData();
  resetProfile();
  resetCvParser();
  resetAssistant();
  resetNotifications();
  session.set({ status: 'signedOut', user: null });
}

export async function logOut() {
  await authApi.logout();
  await signOutLocal();
}

/** Map an error from the auth endpoints to a translation key. */
export function authErrorKey(e: unknown, mode: 'login' | 'register') {
  if (e instanceof ApiError) {
    if (e.kind === 'offline' || e.kind === 'network' || e.kind === 'timeout') return 'auth.errNetwork' as const;
    if (e.status === 401) return 'auth.errBadCredentials' as const;
    if (e.status === 409 || (mode === 'register' && e.status === 400)) return 'auth.errEmailTaken' as const;
  }
  return 'auth.errGeneric' as const;
}
