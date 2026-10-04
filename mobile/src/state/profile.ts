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

export function saveSetup(setup: SearchSetup | undefined) {
  profile.set({ setup, setupDone: true });
  syncRepo();
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
}

export function deleteCvItem(id: string) {
  const cv = profile.get().cv;
  if (!cv) return;
  profile.set({ cv: { ...cv, items: cv.items.filter((i) => i.id !== id) } });
  syncRepo();
}

export function confirmAllCvItems() {
  const cv = profile.get().cv;
  if (!cv) return;
  profile.set({ cv: { ...cv, items: cv.items.map((i) => ({ ...i, status: 'confirmed' as const })) } });
  syncRepo();
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
