/**
 * MOCK REPOSITORY - the backend only exposes auth/users today.
 * Everything here is in-memory sample data behind the typed `Repository`
 * interface. Replace with real endpoints later without touching the UI.
 */
import { ParsingError, type JobListItem, type Repository, type RepoSnapshot } from '../repository';
import type {
  Application,
  ApplicationStatus,
  Approval,
  CvItem,
  Draft,
  DraftKind,
  ImportPreview,
  Job,
  JobQuery,
  MatchResult,
  PrepRun,
  PrepStepKey,
  SearchSetup,
  StepStatus,
} from '../types';
import { daysAgo, hoursAgo, hoursFromNow, SAMPLE_CV_ITEMS, SAMPLE_JOBS, SAMPLE_SETUP, SEED_APPLICATIONS } from './data';
import { computeMatch, levelForScore } from './match';
import {
  applyCvChanges,
  buildApproval,
  buildCoverLetter,
  buildCv,
  buildEmail,
  type Tone,
} from './prep';

const delay = (ms = 500) => new Promise<void>((r) => setTimeout(r, ms + Math.random() * 250));
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

// ---------------------------------------------------------------------------
// In-memory "server" state
// ---------------------------------------------------------------------------

let setup: SearchSetup | undefined = SAMPLE_SETUP;
let cvSkills: string[] = SAMPLE_CV_ITEMS.filter((i) => i.section === 'skills' && i.confidence >= 0.7).map((i) => i.label);
let cvItems: CvItem[] = SAMPLE_CV_ITEMS.map((i) => ({ ...i, status: 'confirmed' as const }));

const jobs = new Map<string, Job>(SAMPLE_JOBS.map((j) => [j.id, j]));
const applications = new Map<string, Application>();
const runs = new Map<string, PrepRun>();
const approvals = new Map<string, Approval>();
const failPrepRuns = new Set<string>();
let simulateSendFailure = false;
let simulatePrepFailure = false;

const SEED_APPROVAL: Approval = {
  id: 'appr_seed_1',
  kind: 'send_application',
  permission: 'public',
  actionName: 'Send application email',
  title: 'Ready to send',
  to: 'careers@medinaapps.example',
  subject: 'Application: React Native Developer',
  body: 'Hello,\n\nI am interested in the React Native Developer role at Medina Apps and have attached my CV and a short cover letter.\n\nI would be glad to answer any questions.\n\nKind regards,\nSample User',
  attachments: [
    { name: 'Tailored CV.pdf', sizeKb: 84 },
    { name: 'Cover letter.pdf', sizeKb: 42 },
  ],
  createdAt: hoursAgo(1),
  expiresAt: hoursFromNow(22),
  onExpire: 'If you do nothing, this request expires and nothing is sent. Your drafts stay saved.',
  status: 'pending',
  sources: ['your CV', 'job post'],
  jobId: 'job_1',
  applicationId: 'app_seed_2',
};

function seed() {
  SEED_APPLICATIONS.forEach((a) => applications.set(a.id, a));
  applications.set('app_seed_2', {
    id: 'app_seed_2',
    jobId: 'job_1',
    jobTitle: 'React Native Developer',
    company: 'Medina Apps',
    location: 'Tunis',
    status: 'preparing',
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(1),
    notes: '',
    timeline: [
      { id: 's1', at: daysAgo(1), kind: 'saved', text: 'Saved the job' },
      { id: 's2', at: hoursAgo(1), kind: 'prepared', text: 'Prepared CV, cover letter and email. Waiting for your approval' },
    ],
    documents: [
      { id: 'd1', kind: 'cv', name: 'Tailored CV' },
      { id: 'd2', kind: 'cover_letter', name: 'Cover letter' },
      { id: 'd3', kind: 'email', name: 'Recruiter email' },
    ],
    matchScore: 84,
    matchLevel: 'strong',
  });
  approvals.set(SEED_APPROVAL.id, SEED_APPROVAL);
}
seed();

function expireIfNeeded(a: Approval): Approval {
  if (a.status === 'pending' && new Date(a.expiresAt).getTime() < Date.now()) {
    const next = { ...a, status: 'expired' as const };
    approvals.set(a.id, next);
    return next;
  }
  return a;
}

function matchFor(job: Job): MatchResult {
  return computeMatch(job, setup, cvSkills);
}

function toListItem(job: Job): JobListItem {
  const m = matchFor(job);
  return { job, match: { score: m.score, level: m.level } };
}

function yearly(job: Job): number | undefined {
  const s = job.salary;
  if (!s) return undefined;
  const top = s.max ?? s.min;
  if (!top) return undefined;
  return s.period === 'year' ? top : s.period === 'month' ? top * 12 : top * 220;
}

const LEVEL_ORDER = { weak: 0, partial: 1, good: 2, strong: 3 } as const;

// ---------------------------------------------------------------------------
// Prep run timeline (derived from elapsed time so it survives app restarts)
// ---------------------------------------------------------------------------

const STEP_ORDER: PrepStepKey[] = ['job_analyzed', 'cv_analyzed', 'cover_letter', 'recruiter_email'];
const STEP_MS = 2600;

function computeRun(run: PrepRun, full: PrepRun): PrepRun {
  const elapsed = Date.now() - new Date(run.startedAt).getTime();
  const failAt = failPrepRuns.has(run.id) ? 2 : -1; // cover_letter step
  let blocked = false;
  const steps = STEP_ORDER.map((key, i) => {
    let status: StepStatus;
    if (blocked) status = 'waiting';
    else if (i === failAt && elapsed >= (i + 0.5) * STEP_MS) {
      status = 'failed';
      blocked = true;
    } else if (elapsed >= (i + 1) * STEP_MS) status = 'done';
    else if (elapsed >= i * STEP_MS) status = 'in_progress';
    else status = 'waiting';
    return { key, status };
  });
  const done = (k: PrepStepKey) => steps.find((s) => s.key === k)?.status === 'done';
  const drafts: PrepRun['drafts'] = {};
  if (done('cv_analyzed') && full.drafts.cv) drafts.cv = full.drafts.cv;
  if (done('cover_letter') && full.drafts.cover_letter) drafts.cover_letter = full.drafts.cover_letter;
  if (done('recruiter_email') && full.drafts.email) drafts.email = full.drafts.email;
  return { ...full, steps, drafts, cvChanges: done('cv_analyzed') ? full.cvChanges : [] };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const mockRepository: Repository = {
  profile: {
    sync(input) {
      if (input.setup) setup = input.setup;
      if (input.cvItems) {
        cvItems = input.cvItems;
        cvSkills = input.cvItems
          .filter((i) => i.section === 'skills' && i.status === 'confirmed')
          .map((i) => i.label);
      }
    },
    async load() {
      await delay(200);
      return null;
    },
    async saveSetup(next) {
      await delay(200);
      setup = next;
      return next;
    },
  },

  cv: {
    async parse(file, onProgress) {
      // Progress covers upload (0-0.3) then reading stages (0.3-1). Simulated timing.
      const stops = [0.1, 0.2, 0.3, 0.45, 0.6, 0.75, 0.9, 1];
      for (const p of stops) {
        onProgress?.(p);
        await delay(p <= 0.3 ? 150 : 550);
      }
      return {
        fileName: file.name,
        isSample: true,
        parsedAt: new Date().toISOString(),
        items: SAMPLE_CV_ITEMS.map((i) => ({ ...i, status: 'pending' as const })),
      };
    },
    async addItem(input) {
      await delay(150);
      const item: CvItem = { ...input, id: uid('cv'), confidence: 1, status: 'confirmed', origin: 'manual' };
      cvItems = [...cvItems, item];
      return item;
    },
    async updateItem(id, patch) {
      await delay(150);
      const cur = cvItems.find((i) => i.id === id);
      if (!cur) throw new Error('CV item not found');
      const next = { ...cur, ...patch };
      cvItems = cvItems.map((i) => (i.id === id ? next : i));
      return next;
    },
    async deleteItem(id) {
      await delay(150);
      cvItems = cvItems.filter((i) => i.id !== id);
    },
  },

  account: {
    async exportData() {
      await delay(300);
      return { sample: true, setup, cvItems, applications: [...applications.values()] };
    },
    async deleteAccount() {
      await delay(300);
    },
  },

  jobs: {
    async list(q: JobQuery = {}) {
      await delay(450);
      let list = [...jobs.values()];
      const text = q.text?.trim().toLowerCase();
      if (text) {
        list = list.filter((j) =>
          [j.title, j.company, j.location, ...j.skills].some((f) => f.toLowerCase().includes(text)),
        );
      }
      if (q.workModes?.length) list = list.filter((j) => !!j.workMode && q.workModes!.includes(j.workMode));
      if (q.employmentTypes?.length) list = list.filter((j) => !!j.employmentType && q.employmentTypes!.includes(j.employmentType));
      if (q.seniority?.length) list = list.filter((j) => !!j.seniority && q.seniority!.includes(j.seniority));
      if (q.salaryMin) list = list.filter((j) => (yearly(j) ?? 0) >= q.salaryMin!);
      let items = list.map(toListItem);
      if (q.minLevel) items = items.filter((i) => LEVEL_ORDER[i.match.level] >= LEVEL_ORDER[q.minLevel!]);
      if (q.sort === 'newest') {
        items.sort((a, b) => +new Date(b.job.postedAt ?? 0) - +new Date(a.job.postedAt ?? 0));
      } else {
        items.sort((a, b) => b.match.score - a.match.score);
      }
      return items;
    },
    async recommended() {
      await delay(350);
      return [...jobs.values()]
        .map(toListItem)
        .sort((a, b) => b.match.score - a.match.score)
        .filter((i) => LEVEL_ORDER[i.match.level] >= LEVEL_ORDER.good)
        .slice(0, 4);
    },
    async get(id) {
      await delay(200);
      const j = jobs.get(id);
      if (!j) throw new Error('Job not found');
      return j;
    },
    async match(id) {
      await delay(500);
      const j = jobs.get(id);
      if (!j) throw new Error('Job not found');
      return matchFor(j);
    },
    async importPreview(rawUrl): Promise<ImportPreview> {
      await delay(1100);
      let url: URL;
      try {
        const withScheme = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
        url = new URL(withScheme);
        if (!url.hostname.includes('.')) throw new Error('bad host');
      } catch {
        throw new ParsingError('That does not look like a link.', 'invalid_url');
      }
      const segments = url.pathname.split('/').filter(Boolean);
      if (url.hostname.includes('fail') || !segments.length) {
        throw new ParsingError('We could not read a job from this page.', 'unreadable');
      }
      const slug = segments[segments.length - 1].replace(/[-_]+/g, ' ').replace(/\.\w+$/, '').replace(/\d{5,}/g, '').trim();
      const title = slug ? slug.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Untitled role';
      const host = url.hostname.replace(/^www\./, '');
      const company = host.split('.')[0].replace(/\b\w/g, (c) => c.toUpperCase());
      const id = uid('job_imp');
      const job: Job = {
        id,
        title,
        company,
        location: 'Not found',
        workMode: 'remote',
        employmentType: 'full_time',
        seniority: 'mid',
        source: { label: `Imported from ${host}`, url: url.toString(), kind: 'imported' },
        postedAt: new Date().toISOString(),
        summary: 'Imported from a link. Review the details below before saving.',
        skills: [],
        description: [
          { type: 'paragraph', text: 'The full description could not be read in this sample build. Open the original posting to read it.' },
        ],
      };
      return {
        url: url.toString(),
        hostLabel: host,
        title,
        company,
        location: 'Not found',
        summary: job.summary,
        missing: ['Location', 'Salary', 'Required skills', 'Full description'],
        job,
      };
    },
    async importConfirm(preview) {
      await delay(300);
      jobs.set(preview.job.id, preview.job);
      return preview.job;
    },
  },

  applications: {
    async list() {
      await delay(200);
      return [...applications.values()].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    },
    async create(job, status, match) {
      await delay(150);
      const existing = [...applications.values()].find((a) => a.jobId === job.id);
      if (existing) return existing;
      const app: Application = {
        id: uid('app'),
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: '',
        timeline: [
          {
            id: uid('t'),
            at: new Date().toISOString(),
            kind: 'saved',
            text: status === 'preparing' ? 'Started preparing an application' : 'Saved the job',
          },
        ],
        documents: [],
        matchScore: match?.score,
        matchLevel: match?.level ?? (match ? levelForScore(match.score) : undefined),
      };
      jobs.set(job.id, job);
      applications.set(app.id, app);
      return app;
    },
    async updateStatus(id, status: ApplicationStatus) {
      await delay(150);
      const a = applications.get(id);
      if (!a) throw new Error('Application not found');
      const next: Application = {
        ...a,
        status,
        updatedAt: new Date().toISOString(),
        appliedAt: status === 'applied' && !a.appliedAt ? new Date().toISOString() : a.appliedAt,
        timeline: [
          ...a.timeline,
          { id: uid('t'), at: new Date().toISOString(), kind: 'status', text: `Status changed to ${status}` },
        ],
      };
      applications.set(id, next);
      return next;
    },
    async remove(id) {
      applications.delete(id);
    },
    async updateNotes(id, notes) {
      const a = applications.get(id);
      if (!a) throw new Error('Application not found');
      const next = { ...a, notes, updatedAt: new Date().toISOString() };
      applications.set(id, next);
      return next;
    },
    async setReminder(id, reminder) {
      await delay(120);
      const a = applications.get(id);
      if (!a) throw new Error('Application not found');
      const next: Application = {
        ...a,
        reminder: reminder ?? undefined,
        updatedAt: new Date().toISOString(),
        timeline: reminder
          ? [...a.timeline, { id: uid('t'), at: new Date().toISOString(), kind: 'reminder', text: 'Follow-up reminder set' }]
          : a.timeline,
      };
      applications.set(id, next);
      return next;
    },
  },

  prep: {
    async start(job, userName) {
      await delay(300);
      const { draft: cv, changes } = buildCv(job, userName, cvItems);
      const run: PrepRun = {
        id: uid('run'),
        jobId: job.id,
        startedAt: new Date().toISOString(),
        steps: STEP_ORDER.map((key) => ({ key, status: 'waiting' as StepStatus })),
        drafts: {
          cv,
          cover_letter: buildCoverLetter(job, userName, cvItems, 'formal'),
          email: buildEmail(job, userName),
        },
        cvChanges: changes,
      };
      runs.set(run.id, run);
      if (simulatePrepFailure) failPrepRuns.add(run.id);
      return computeRun(run, run);
    },
    async get(runId) {
      const run = runs.get(runId);
      if (!run) throw new Error('Preparation not found');
      return computeRun(run, run);
    },
    async retryStep(runId) {
      await delay(200);
      const run = runs.get(runId);
      if (!run) throw new Error('Preparation not found');
      failPrepRuns.delete(runId);
      // Resume right where the failed step began.
      const next = { ...run, startedAt: new Date(Date.now() - 2 * STEP_MS).toISOString() };
      runs.set(runId, next);
      return computeRun(next, next);
    },
    async saveDraft(runId, draft) {
      const run = runs.get(runId);
      if (!run) throw new Error('Preparation not found');
      const next: PrepRun = {
        ...run,
        drafts: { ...run.drafts, [draft.kind]: { ...draft, edited: true, updatedAt: new Date().toISOString() } },
      };
      runs.set(runId, next);
      return computeRun(next, next);
    },
    async regenerate(runId, kind: DraftKind, tone = 'formal') {
      await delay(900);
      const run = runs.get(runId);
      const job = run && jobs.get(run.jobId);
      if (!run || !job) throw new Error('Preparation not found');
      const name = run.drafts.cover_letter?.body.split('\n').pop() ?? 'Applicant';
      let draft: Draft;
      if (kind === 'cover_letter') draft = buildCoverLetter(job, name, cvItems, tone as Tone);
      else if (kind === 'email') draft = buildEmail(job, name, tone as Tone);
      else draft = run.drafts.cv!;
      runs.set(runId, { ...run, drafts: { ...run.drafts, [kind]: draft } });
      return draft;
    },
    async setCvChange(runId, changeId, status) {
      const run = runs.get(runId);
      if (!run) throw new Error('Preparation not found');
      const cvChanges = run.cvChanges.map((c) => (c.id === changeId ? { ...c, status } : c));
      const cv = run.drafts.cv ? applyCvChanges(run.drafts.cv, cvChanges) : undefined;
      const next: PrepRun = { ...run, cvChanges, drafts: { ...run.drafts, ...(cv ? { cv } : {}) } };
      runs.set(runId, next);
      return computeRun(next, next);
    },
    async requestApproval(runId) {
      await delay(400);
      const run = runs.get(runId);
      const job = run && jobs.get(run.jobId);
      if (!run || !job) throw new Error('Preparation not found');
      const app = [...applications.values()].find((a) => a.jobId === job.id);
      const approval = buildApproval(job, run.drafts, app?.id);
      approvals.set(approval.id, approval);
      runs.set(runId, { ...run, approvalId: approval.id });
      return approval;
    },
  },

  approvals: {
    async list() {
      await delay(200);
      return [...approvals.values()]
        .map(expireIfNeeded)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    },
    async get(id) {
      const a = approvals.get(id);
      if (!a) throw new Error('Approval not found');
      return expireIfNeeded(a);
    },
    async create(approval) {
      approvals.set(approval.id, approval);
      return approval;
    },
    async approve(id) {
      await delay(1400);
      const a = approvals.get(id);
      if (!a) throw new Error('Approval not found');
      const cur = expireIfNeeded(a);
      if (cur.status === 'expired') {
        return { ok: false, message: 'This request expired. Nothing was sent. You can prepare it again at any time.' };
      }
      if (cur.status !== 'pending') {
        return { ok: false, message: 'This request was already handled. Nothing more was sent.' };
      }
      if (simulateSendFailure) {
        const failed: Approval = { ...cur, failureReason: 'The mail service did not respond.' };
        approvals.set(id, failed);
        return {
          ok: false,
          message: 'Nothing was sent. The mail service did not respond. Your drafts are safe and you can try again.',
        };
      }
      const sentAt = new Date().toISOString();
      approvals.set(id, { ...cur, status: 'sent', failureReason: undefined });
      return { ok: true, message: 'Sent', sentAt };
    },
    async cancel(id) {
      await delay(200);
      const a = approvals.get(id);
      if (!a) throw new Error('Approval not found');
      const next: Approval = { ...a, status: 'cancelled' };
      approvals.set(id, next);
      return next;
    },
  },

  usage: {
    async get() {
      await delay(250);
      return {
        plan: 'Free',
        aiRuns: { used: 7, limit: 20 },
        applications: { used: 2, limit: 5 },
        resetsAt: new Date(Date.now() + 12 * 86400_000).toISOString(),
      };
    },
  },

  dev: {
    reset() {
      setup = undefined;
      cvItems = [];
      cvSkills = [];
      jobs.clear();
      applications.clear();
      runs.clear();
      approvals.clear();
      failPrepRuns.clear();
    },
    hydrate(snapshot: Partial<RepoSnapshot>) {
      snapshot.jobs?.forEach((j) => jobs.set(j.id, j));
      snapshot.applications?.forEach((a) => applications.set(a.id, a));
      snapshot.runs?.forEach((r) => runs.set(r.id, r));
      snapshot.approvals?.forEach((a) => approvals.set(a.id, a));
    },
    setSimulateSendFailure(v) {
      simulateSendFailure = v;
    },
    setSimulatePrepFailure(v) {
      simulatePrepFailure = v;
    },
  },
};
