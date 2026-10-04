import { useNetwork } from '@/lib/network';

/** `{ online, disabledReasonKey }` for network-needing buttons: disable and explain. */
export function useOnlineAction() {
  const { online } = useNetwork();
  return { online, offline: !online };
}
