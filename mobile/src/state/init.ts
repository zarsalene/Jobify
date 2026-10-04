import { startNetworkMonitor } from '@/lib/network';

import { hydrateAssistant } from './assistant';
import { hydrateData } from './data';
import { hydratePreferences } from './preferences';
import { hydrateProfile } from './profile';
import { bootstrapSession, session } from './session';

let started: Promise<void> | null = null;

/** Hydrate persisted state, start the network monitor and restore the session. Idempotent. */
export function initApp(): Promise<void> {
  if (!started) {
    startNetworkMonitor();
    started = (async () => {
      await Promise.all([hydratePreferences(), hydrateProfile(), hydrateData(), hydrateAssistant()]);
      await bootstrapSession();
    })().catch(() => {
      /* never block launch on storage trouble */
      if (session.get().status === 'loading') session.set({ status: 'signedOut', user: null });
    });
  }
  return started;
}
