import NetInfo from '@react-native-community/netinfo';

import { createStore } from './store';

/** Online/offline state from NetInfo. `online` is optimistic until the first reading arrives. */
export const networkStore = createStore<{ online: boolean; ready: boolean }>({
  online: true,
  ready: false,
});

let started = false;

export function startNetworkMonitor(): () => void {
  if (started) return () => {};
  started = true;
  const unsub = NetInfo.addEventListener((s) => {
    // isInternetReachable is null while unknown - treat unknown as online.
    const online = s.isConnected !== false && s.isInternetReachable !== false;
    networkStore.set({ online, ready: true });
  });
  return () => {
    started = false;
    unsub();
  };
}

export const isOnline = () => networkStore.get().online;

/** Hook: `{ online }`. */
export function useNetwork() {
  const online = networkStore.use((s) => s.online);
  return { online };
}
