import { sampleNotifications, type AppNotification } from '@/api/mock/notifications';
import { createStore, persistStore } from '@/lib/store';

export type { AppNotification };

export interface NotificationsState {
  hydrated: boolean;
  items: AppNotification[];
}

/** In-app notification center. Sample items until push / server notifications are connected. */
export const notifications = createStore<NotificationsState>({
  hydrated: false,
  items: sampleNotifications(),
});

/** Number of unread notifications. Pass a list, or omit to read the current store. */
export function unreadCount(items: AppNotification[] = notifications.get().items): number {
  return items.filter((n) => !n.read).length;
}

/** Hook version for badges (re-renders when items change). */
export function useUnreadCount(): number {
  return notifications.use((s) => s.items.filter((n) => !n.read).length);
}

export function markRead(id: string) {
  notifications.set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
}

export function markAllRead() {
  notifications.set((s) => ({ items: s.items.map((n) => (n.read ? n : { ...n, read: true })) }));
}

/** Back to the sample set (used when local data is wiped). */
export function resetNotifications() {
  notifications.set({ items: sampleNotifications() });
}

let started: Promise<void> | null = null;

/** Restore persisted read-state. Idempotent; also runs once when this module is first imported. */
export function hydrateNotifications(): Promise<void> {
  if (!started) {
    started = persistStore(notifications, 'rolenest.notifications.v1', ['items'])
      .catch(() => {
        /* storage trouble must never block the UI */
      })
      .then(() => {
        notifications.set({ hydrated: true });
      });
  }
  return started;
}

void hydrateNotifications();
