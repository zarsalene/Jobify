import { Appearance } from 'react-native';

import { repo } from '@/api';
import { setLanguagePreference, type Locale } from '@/i18n';
import { createStore, persistStore } from '@/lib/store';

export type ThemePref = 'system' | 'light' | 'dark';
export type NotificationType = 'approvals' | 'applications' | 'matches' | 'reminders' | 'system';

export interface QuietHours {
  enabled: boolean;
  /** minutes after midnight */
  start: number;
  end: number;
}

export interface PreferencesState {
  hydrated: boolean;
  theme: ThemePref;
  language: Locale | 'system';
  notifications: Record<NotificationType, boolean>;
  quietHours: QuietHours;
  /** Developer switches (Settings > Sample data tools). */
  simulateSendFailure: boolean;
  simulatePrepFailure: boolean;
}

export const preferences = createStore<PreferencesState>({
  hydrated: false,
  theme: 'system',
  language: 'system',
  notifications: { approvals: true, applications: true, matches: true, reminders: true, system: true },
  quietHours: { enabled: false, start: 22 * 60, end: 8 * 60 },
  simulateSendFailure: false,
  simulatePrepFailure: false,
});

export function applyTheme(theme: ThemePref) {
  try {
    Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
  } catch {
    /* web */
  }
}

export function setTheme(theme: ThemePref) {
  preferences.set({ theme });
  applyTheme(theme);
}

export function setLanguage(language: Locale | 'system') {
  preferences.set({ language });
  return setLanguagePreference(language);
}

export function setSimulateSendFailure(v: boolean) {
  preferences.set({ simulateSendFailure: v });
  repo.dev.setSimulateSendFailure(v);
}

export function setSimulatePrepFailure(v: boolean) {
  preferences.set({ simulatePrepFailure: v });
  repo.dev.setSimulatePrepFailure(v);
}

export function setNotificationType(type: NotificationType, on: boolean) {
  preferences.set((s) => ({ notifications: { ...s.notifications, [type]: on } }));
}

export function setQuietHours(patch: Partial<QuietHours>) {
  preferences.set((s) => ({ quietHours: { ...s.quietHours, ...patch } }));
}

export async function hydratePreferences() {
  await persistStore(preferences, 'rolenest.prefs.v1', [
    'theme',
    'language',
    'notifications',
    'quietHours',
    'simulateSendFailure',
    'simulatePrepFailure',
  ]);
  const s = preferences.get();
  applyTheme(s.theme);
  setLanguagePreference(s.language);
  repo.dev.setSimulateSendFailure(s.simulateSendFailure);
  repo.dev.setSimulatePrepFailure(s.simulatePrepFailure);
  preferences.set({ hydrated: true });
}
