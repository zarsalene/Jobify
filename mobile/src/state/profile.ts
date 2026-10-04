import { Alert } from 'react-native';

import { repo, type CvItem, type ParsedCv, type SearchSetup } from '@/api';
import { createStore, persistStore } from '@/lib/store';

export interface Consent {
  /** Required to use the app. */
  data: boolean;
  /** Required for AI features. */
  ai: boolean;
  /** Optional. */
  analytics: boolean;
  decidedAt?: string;
}

export interface ProfileState {
  hydrated: boolean;
  consent: Consent;
  setup?: SearchSetup;
  cv: ParsedCv | null;
  /** Onboarding progress flags. */
  consentDone: boolean;
  setupDone: boolean;
  cvDone: boolean;
}

export const profile = createStore<ProfileState>({
  hydrated: false,
  consent: { data: false, ai: false, analytics: false },
  setup: undefined,
  cv: null,
  consentDone: false,
  setupDone: false,
  cvDone: false,
});

function syncRepo() {
  const s = profile.get();
  repo.profile.sync({ setup: s.setup, cvItems: s.cv?.items });
}

export function saveConsent(consent: Omit<Consent, 'decidedAt'>) {
  profile.set({ consent: { ...consent, decidedAt: new Date().toISOString() }, consentDone: true });
}

export function updateConsent(patch: Partial<Omit<Consent, 'decidedAt'>>) {
  const cur = profile.get().consent;
  profile.set({ consent: { ...cur, ...patch, decidedAt: new Date().toISOString() } });
}

/**
 * Changes are shown at once and saved to the server in the background. If the server refuses,
 * the change is undone on screen and the user is told, so the phone never shows something the
 * server doesn't have.
 */
function saveOrRevert(previous: Partial<ProfileState>, save: () => Promise<unknown>) {
  save().catch((e: unknown) => {
    profile.set(previous);
    syncRepo();
    const reason = e instanceof Error ? e.message : '';
    Alert.alert("Couldn't save your change", `${reason}
Nothing was changed. Try again when you're online.`.trim());
  });
}

export function saveSetup(setup: SearchSetup | undefined) {
  const previous = { setup: profile.get().setup };
  profile.set({ setup, setupDone: true });
  syncRepo();
  if (setup) saveOrRevert(previous, () => repo.profile.saveSetup(setup));
}

export function setParsedCv(cv: ParsedCv | null) {
  profile.set({ cv });
  syncRepo();
}

export function finishCvStep() {
  profile.set({ cvDone: true });
  syncRepo();
}

export function updateCvItem(id: string, patch: Partial<CvItem>) {
  const cv = profile.get().cv;
  if (!cv) return;
  profile.set({ cv: { ...cv, items: cv.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } });
  syncRepo();
  const { label, detail, status } = patch;
  saveOrRevert({ cv }, () => repo.cv.updateItem(id, { label, detail, status, ...('detail' in patch ? { detail } : {}) }));
}

export function deleteCvItem(id: string) {
  const cv = profile.get().cv;
  if (!cv) return;
  profile.set({ cv: { ...cv, items: cv.items.filter((i) => i.id !== id) } });
  syncRepo();
  saveOrRevert({ cv }, () => repo.cv.deleteItem(id));
}

export function confirmAllCvItems() {
  const cv = profile.get().cv;
  if (!cv) return;
  const pending = cv.items.filter((i) => i.status !== 'confirmed');
  profile.set({ cv: { ...cv, items: cv.items.map((i) => ({ ...i, status: 'confirmed' as const })) } });
  syncRepo();
  saveOrRevert({ cv }, () => Promise.all(pending.map((i) => repo.cv.updateItem(i.id, { status: 'confirmed' }))));
}

/** Add an item the user typed. Saved on the server first, so it gets the server's id. */
export async function addCvItem(input: Pick<CvItem, 'section' | 'label' | 'detail'>) {
  const item = await repo.cv.addItem(input);
  const cv = profile.get().cv ?? { fileName: '', parsedAt: new Date().toISOString(), items: [] };
  profile.set({ cv: { ...cv, items: [...cv.items, item] } });
  syncRepo();
  return item;
}

/**
 * Replace the cached profile with the server's copy (after login, or on another device).
 * Offline or a server error keeps the cached copy.
 */
export async function refreshProfileFromServer() {
  try {
    const remote = await repo.profile.load();
    if (!remote) return;
    profile.set({
      setup: remote.setup ?? profile.get().setup,
      cv: remote.cv,
      ...(remote.setup ? { setupDone: true } : {}),
      ...(remote.cv ? { cvDone: true } : {}),
    });
    syncRepo();
  } catch {
    /* keep the cached profile */
  }
}

/** 0..100 - how complete the profile is, with the missing pieces named. */
export function profileCompleteness(s: ProfileState): { percent: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ['Target role', !!s.setup?.targetRole],
    ['Location', !!s.setup?.location],
    ['Seniority', !!s.setup?.seniority],
    ['CV uploaded', !!s.cv],
    ['CV reviewed', !!s.cv && s.cv.items.every((i) => i.status === 'confirmed')],
    ['AI consent', s.consent.ai],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter(([, ok]) => !ok).map(([n]) => n),
  };
}

export function resetProfile() {
  profile.set({
    consent: { data: false, ai: false, analytics: false },
    setup: undefined,
    cv: null,
    consentDone: false,
    setupDone: false,
    cvDone: false,
  });
}

export async function hydrateProfile() {
  await persistStore(profile, 'rolenest.profile.v1', ['consent', 'setup', 'cv', 'consentDone', 'setupDone', 'cvDone']);
  syncRepo();
  profile.set({ hydrated: true });
}
