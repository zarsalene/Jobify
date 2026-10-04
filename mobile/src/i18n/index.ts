import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import { createStore } from '@/lib/store';

import ar from './locales/ar';
import en from './locales/en';
import fr from './locales/fr';

export type Locale = 'en' | 'fr' | 'ar';
export const SUPPORTED_LOCALES: Locale[] = ['en', 'fr', 'ar'];
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
};
export const RTL_LOCALES: Locale[] = ['ar'];

type Dict = typeof en;
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** All translation keys, as "section.key" paths into the English dictionary. */
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Paths<Dict>;

const dictionaries: Record<Locale, DeepPartial<Dict>> = { en, fr, ar };

function detectDeviceLocale(): Locale {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase();
    if (code && (SUPPORTED_LOCALES as string[]).includes(code)) return code as Locale;
  } catch {
    /* ignore */
  }
  return 'en';
}

export const localeStore = createStore<{ locale: Locale; preference: Locale | 'system' }>({
  locale: detectDeviceLocale(),
  preference: 'system',
});

/** Apply the user's language preference ('system' follows the device). */
export function setLanguagePreference(pref: Locale | 'system'): { needsRestart: boolean } {
  const locale = pref === 'system' ? detectDeviceLocale() : pref;
  localeStore.set({ locale, preference: pref });
  const wantRtl = RTL_LOCALES.includes(locale);
  let needsRestart = false;
  if (I18nManager.isRTL !== wantRtl) {
    // React Native applies the layout direction at app start, so a restart is needed
    // after switching between LTR and RTL languages.
    try {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(wantRtl);
    } catch {
      /* web */
    }
    needsRestart = true;
  }
  return { needsRestart };
}

function lookup(dict: unknown, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

export type TParams = Record<string, string | number>;

/** Translate a key, falling back to English. `{name}` placeholders are interpolated. */
export function t(key: TKey, params?: TParams, locale: Locale = localeStore.get().locale): string {
  const raw = lookup(dictionaries[locale], key) ?? lookup(en, key) ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

/** Hook: re-renders when the language changes. */
export function useT() {
  const locale = localeStore.use((s) => s.locale);
  return {
    locale,
    isRTL: RTL_LOCALES.includes(locale),
    t: (key: TKey, params?: TParams) => t(key, params, locale),
  };
}
