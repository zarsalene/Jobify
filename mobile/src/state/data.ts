/**
 * App data + offline cache. The store is persisted to AsyncStorage so saved
 * jobs, the tracker, drafts and approvals stay readable offline. Actions that
 * need the network check connectivity first and throw ApiError('offline').
 */
import {
  ApiError,
  repo,
  type Application,
  type ApplicationStatus,
  type Approval,
  type CvChange,
  type Draft,
  type Job,
  type JobListItem,
  type JobQuery,
  type MatchResult,
  type PrepRun,
  type Reminder,
  type SendResult,
} from '@/api';
import { isOnline } from '@/lib/network';
import { createStore, persistStore } from '@/lib/store';

import { session } from './session';

export interface MatchSummary {
  score: number;
  level: MatchResult['level'];
}

export interface DataState {
  hydrated: boolean;
  /** Every job we have seen, by id - the offline cache. */
  jobs: Record<string, Job>;
  matchSummaries: Record<string, MatchSummary>;
  /** Full match results, cached after first view. */
  matches: Record<string, MatchResult>;
  /** Last unfiltered feed order. */
  feedIds: string[];
  recommendedIds: string[];
  savedIds: string[];
  applications: Application[];
  runs: Record<string, PrepRun>;
  approvals: Approval[];
  /** run per job so "Prepare application" can resume. */
  runByJob: Record<string, string>;
  lastSyncedAt?: string;
}

const initial: DataState = {
  hydrated: false,
  jobs: {},
  matchSummaries: {},
  matches: {},
  feedIds: [],
  recommendedIds: [],
  savedIds: [],
  applications: [],
  runs: {},
  approvals: [],
  runByJob: {},
};

export const data = createStore<DataState>(initial);

export function requireOnline() {
  if (!isOnline()) throw new ApiError('offline', 'You are offline.');
}

function absorbJobs(items: JobListItem[]) {
  const s = data.get();
  const jobs = { ...s.jobs };
  const matchSummaries = { ...s.matchSummaries };
  items.forEach(({ job, match }) => {
    jobs[job.id] = job;
    matchSummaries[job.id] = { score: match.score, level: match.level };
  });
  return { jobs, matchSummaries };
}

// --- Jobs ------------------------------------------------------------------

function isUnfiltered(q: JobQuery) {
  return !q.text && !q.workModes?.length && !q.employmentTypes?.length && !q.seniority?.length && !q.salaryMin && !q.minLevel && !q.savedOnly;
}

/** Fetch the feed. Falls back to the local cache when offline. Returns `fromCache` so UIs can say so. */
export async function fetchJobs(q: JobQuery = {}): Promise<{ items: JobListItem[]; fromCache: boolean }> {
  if (!isOnline()) return { items: cachedJobs(q), fromCache: true };
  const items = await repo.jobs.list(q);
  const patch = absorbJobs(items);
  data.set({
    ...patch,
    ...(isUnfiltered(q) ? { feedIds: items.map((i) => i.job.id) } : {}),
    lastSyncedAt: new Date().toISOString(),
  });
  return { items, fromCache: false };
}

export function cachedJobs(q: JobQuery = {}): JobListItem[] {
  const s = data.get();
  const text = q.text?.trim().toLowerCase();
  const ids = q.savedOnly ? s.savedIds : s.feedIds.length ? s.feedIds : Object.keys(s.jobs);
  return ids
    .map((id) => s.jobs[id])
    .filter((j): j is Job => !!j)
    .filter((j) => !text || [j.title, j.company, j.location, ...j.skills].some((f) => f.toLowerCase().includes(text)))
    .map((job) => ({ job, match: s.matchSummaries[job.id] ?? { score: 0, level: 'weak' as const } }));
}

export async function fetchRecommended(): Promise<JobListItem[]> {
  if (!isOnline()) {
    const s = data.get();
    return s.recommendedIds
      .map((id) => s.jobs[id])
      .filter((j): j is Job => !!j)
      .map((job) => ({ job, match: s.matchSummaries[job.id] ?? { score: 0, level: 'weak' as const } }));
  }
  const items = await repo.jobs.recommended();
  data.set({ ...absorbJobs(items), recommendedIds: items.map((i) => i.job.id) });
  return items;
}

export async function fetchJob(id: string): Promise<Job> {
  const cached = data.get().jobs[id];
  if (!isOnline()) {
    if (cached) return cached;
    throw new ApiError('offline', 'You are offline.');
  }
  const job = await repo.jobs.get(id);
  data.set({ jobs: { ...data.get().jobs, [id]: job } });
  return job;
}

export async function fetchMatch(id: string): Promise<MatchResult> {
  if (!isOnline()) {
    const m = data.get().matches[id];
    if (m) return m;
    throw new ApiError('offline', 'You are offline.');
  }
  const m = await repo.jobs.match(id);
  const s = data.get();
  data.set({
    matches: { ...s.matches, [id]: m },
    matchSummaries: { ...s.matchSummaries, [id]: { score: m.score, level: m.level } },
  });
  return m;
}

export function isSaved(id: string) {
  return data.get().savedIds.includes(id);
}

/** Saving works offline (local first). Returns the new saved state. */
export async function toggleSave(job: Job): Promise<boolean> {
  const s = data.get();
  const saved = s.savedIds.includes(job.id);
  if (saved) {
    const app = s.applications.find((a) => a.jobId === job.id);
    const removeApp = app && app.status === 'saved';
    data.set({
      savedIds: s.savedIds.filter((i) => i !== job.id),
      applications: removeApp ? s.applications.filter((a) => a.id !== app!.id) : s.applications,
    });
    if (removeApp) void repo.applications.remove(app!.id);
    return false;
  }
  data.set({ savedIds: [...s.savedIds, job.id], jobs: { ...s.jobs, [job.id]: job } });
  if (!s.applications.some((a) => a.jobId === job.id)) {
    const app = await repo.applications.create(job, 'saved', s.matchSummaries[job.id]);
    data.set({ applications: [app, ...data.get().applications] });
  }
  return true;
}

export async function importJobFromUrl(url: string) {
  requireOnline();
  return repo.jobs.importPreview(url);
}

export async function confirmImport(preview: Parameters<typeof repo.jobs.importConfirm>[0]): Promise<Job> {
  requireOnline();
  const job = await repo.jobs.importConfirm(preview);
  data.set({ jobs: { ...data.get().jobs, [job.id]: job } });
  return job;
}

// --- Applications ------------------------------------------------------------

export async function loadApplications() {
  if (!isOnline()) return data.get().applications;
  const list = await repo.applications.list();
  data.set({ applications: list, lastSyncedAt: new Date().toISOString() });
  return list;
}

function replaceApplication(app: Application) {
  const s = data.get();
  const exists = s.applications.some((a) => a.id === app.id);
  data.set({ applications: exists ? s.applications.map((a) => (a.id === app.id ? app : a)) : [app, ...s.applications] });
}

export async function setApplicationStatus(id: string, status: ApplicationStatus) {
  const app = await repo.applications.updateStatus(id, status);
  replaceApplication(app);
  return app;
}

export async function setApplicationNotes(id: string, notes: string) {
  const app = await repo.applications.updateNotes(id, notes);
  replaceApplication(app);
  return app;
}

export async function setApplicationReminder(id: string, reminder: Reminder | null) {
  const app = await repo.applications.setReminder(id, reminder);
  replaceApplication(app);
  return app;
}

// --- Preparation -----------------------------------------------------------

export async function startPreparation(job: Job): Promise<PrepRun> {
  requireOnline();
  const s = data.get();
  const existingRunId = s.runByJob[job.id];
  const existing = existingRunId ? s.runs[existingRunId] : undefined;
  // Resume an unfinished run rather than starting another one.
  if (existing && !existing.approvalId) return refreshRun(existing.id);

  let app = s.applications.find((a) => a.jobId === job.id);
  if (!app) app = await repo.applications.create(job, 'preparing', s.matchSummaries[job.id]);
  else if (app.status === 'saved') app = await repo.applications.updateStatus(app.id, 'preparing');
  replaceApplication(app);

  const run = await repo.prep.start(job, session.get().user?.full_name ?? 'Applicant');
  const cur = data.get();
  data.set({
    runs: { ...cur.runs, [run.id]: run },
    runByJob: { ...cur.runByJob, [job.id]: run.id },
    jobs: { ...cur.jobs, [job.id]: job },
  });
  return run;
}

export async function refreshRun(runId: string): Promise<PrepRun> {
  if (!isOnline()) {
    const r = data.get().runs[runId];
    if (r) return r;
    throw new ApiError('offline', 'You are offline.');
  }
  const run = await repo.prep.get(runId);
  data.set({ runs: { ...data.get().runs, [runId]: run } });
  return run;
}

function putRun(run: PrepRun) {
  data.set({ runs: { ...data.get().runs, [run.id]: run } });
  return run;
}

export async function retryPrepStep(runId: string) {
  requireOnline();
  return putRun(await repo.prep.retryStep(runId));
}

export async function saveDraft(runId: string, draft: Draft) {
  // Edits are saved locally first so they are never lost offline.
  const cur = data.get().runs[runId];
  if (cur) putRun({ ...cur, drafts: { ...cur.drafts, [draft.kind]: { ...draft, edited: true } } });
  return putRun(await repo.prep.saveDraft(runId, draft));
}

export async function regenerateDraft(runId: string, kind: Draft['kind'], tone?: string) {
  requireOnline();
  const draft = await repo.prep.regenerate(runId, kind, tone);
  const cur = data.get().runs[runId];
  if (cur) putRun({ ...cur, drafts: { ...cur.drafts, [kind]: draft } });
  return draft;
}

export async function setCvChange(runId: string, changeId: string, status: CvChange['status']) {
  return putRun(await repo.prep.setCvChange(runId, changeId, status));
}

export async function requestApproval(runId: string): Promise<Approval> {
  requireOnline();
  const approval = await repo.prep.requestApproval(runId);
  const s = data.get();
  data.set({
    approvals: [approval, ...s.approvals.filter((a) => a.id !== approval.id)],
    runs: s.runs[runId] ? { ...s.runs, [runId]: { ...s.runs[runId], approvalId: approval.id } } : s.runs,
  });
  return approval;
}

// --- Approvals -------------------------------------------------------------

export async function loadApprovals() {
  if (!isOnline()) return data.get().approvals;
  const list = await repo.approvals.list();
  data.set({ approvals: list });
  return list;
}

function putApproval(a: Approval) {
  const s = data.get();
  const exists = s.approvals.some((x) => x.id === a.id);
  data.set({ approvals: exists ? s.approvals.map((x) => (x.id === a.id ? a : x)) : [a, ...s.approvals] });
}

/** Register an approval created elsewhere (e.g. by the assistant). It appears in the inbox; nothing is executed. */
export async function registerApproval(approval: Approval): Promise<Approval> {
  const a = await repo.approvals.create(approval);
  putApproval(a);
  return a;
}

/** The only path that sends. Callers must have shown the approval screen first. */
export async function approveAndSend(id: string): Promise<SendResult> {
  requireOnline();
  const result = await repo.approvals.approve(id);
  const fresh = await repo.approvals.get(id);
  putApproval(fresh);
  if (result.ok && fresh.applicationId) {
    await setApplicationStatus(fresh.applicationId, 'applied').catch(() => {});
    // Record the send on the timeline.
    const app = data.get().applications.find((a) => a.id === fresh.applicationId);
    if (app) {
      replaceApplication({
        ...app,
        timeline: [
          ...app.timeline,
          { id: `sent_${Date.now()}`, at: new Date().toISOString(), kind: 'sent', text: 'You approved and sent the application' },
        ],
      });
    }
  }
  return result;
}

export async function cancelApproval(id: string) {
  const a = await repo.approvals.cancel(id);
  putApproval(a);
  return a;
}

export function pendingApprovals(list: Approval[]) {
  return list.filter((a) => a.status === 'pending' && new Date(a.expiresAt).getTime() > Date.now());
}

// --- Lifecycle -------------------------------------------------------------

export function resetData() {
  data.set({ ...initial, hydrated: true });
}

export async function hydrateData() {
  await persistStore(data, 'rolenest.data.v1', [
    'jobs',
    'matchSummaries',
    'matches',
    'feedIds',
    'recommendedIds',
    'savedIds',
    'applications',
    'runs',
    'approvals',
    'runByJob',
    'lastSyncedAt',
  ]);
  const s = data.get();
  repo.dev.hydrate({
    jobs: Object.values(s.jobs),
    applications: s.applications,
    runs: Object.values(s.runs),
    approvals: s.approvals,
  });
  data.set({ hydrated: true });
}
