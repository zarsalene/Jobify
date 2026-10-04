/**
 * REAL repository: talks to the FastAPI backend for profile, CV, jobs, matching,
 * applications and account data.
 *
 * Still on-device (the sample engine in ./mock) until the backend has them:
 * - document drafting (tailored CV, cover letter, email). It is fed only the user's own
 *   setup and CV items via `profile.sync`, never sample data.
 * - application approvals. Sending email isn't connected, so approving reports honestly that
 *   nothing was sent.
 * - usage figures, which report "not available" instead of sample numbers.
 */
import { ApiError, request } from './client';
import { mockRepository as local } from './mock';
import { ParsingError, type JobListItem, type Repository } from './repository';
import type { components } from './schema';
import type {
  Application,
  CvItem,
  ImportPreview,
  Job,
  JobQuery,
  MatchResult,
  ParsedCv,
  SearchSetup,
} from './types';

type S = components['schemas'];

// The sample engine starts seeded with sample people and jobs; none of that may leak in.
local.dev.reset();

// ---------------------------------------------------------------------------
// Server shape -> app shape. `null` from the server means "not stated" and becomes
// `undefined`; nothing is filled in with a default.
// ---------------------------------------------------------------------------

const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

function toJob(j: S['JobRead']): Job {
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    workMode: opt(j.workMode),
    employmentType: opt(j.employmentType),
    seniority: opt(j.seniority),
    salary: j.salary ? toSalary(j.salary) : undefined,
    source: { label: j.source.label, url: j.source.url, kind: j.source.kind },
    postedAt: opt(j.postedAt),
    summary: j.summary,
    description: j.description.map((b) => ({ type: b.type, text: b.text, requirement: b.requirement || undefined })),
    skills: j.skills,
  };
}

function toSalary(s: S['Salary']): NonNullable<Job['salary']> {
  return {
    min: opt(s.min),
    max: opt(s.max),
    currency: opt(s.currency),
    period: opt(s.period),
    text: opt(s.text),
    source: s.source,
  };
}

function toListItem(i: S['JobListItem']): JobListItem {
  return {
    job: toJob(i.job),
    match: { score: i.match.score, level: i.match.level },
    applicationId: opt(i.applicationId),
    applicationStatus: opt(i.applicationStatus),
  };
}

function toMatch(m: S['MatchRead']): MatchResult {
  const factor = (f: S['MatchFactor']) => ({
    key: f.key as MatchResult['factors']['deterministic'][number]['key'],
    label: f.label,
    status: f.status,
    detail: f.detail,
  });
  return {
    jobId: m.jobId,
    score: m.score,
    level: m.level,
    reason: m.reason,
    strengths: m.strengths,
    gaps: m.gaps.map((g) => ({ label: g.label, howToClose: g.howToClose })),
    factors: { deterministic: m.factors.deterministic.map(factor), ai: m.factors.ai.map(factor) },
    basedOn: m.basedOn,
    generatedAt: m.generatedAt,
  };
}

function toApplication(a: S['ApplicationRead']): Application {
  return {
    id: a.id,
    jobId: opt(a.jobId),
    jobTitle: a.jobTitle,
    company: a.company,
    location: a.location,
    status: a.status,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    appliedAt: opt(a.appliedAt),
    notes: a.notes,
    reminder: a.reminder ? { dueAt: a.reminder.dueAt, note: opt(a.reminder.note) } : undefined,
    timeline: a.timeline.map((e) => ({ id: e.id, at: e.at, kind: e.kind, text: e.text })),
    // Documents are prepared on the device for now and not stored on the server yet.
    documents: [],
    matchScore: opt(a.matchScore),
    matchLevel: opt(a.matchLevel),
  };
}

function toCvItem(i: S['CvItemRead']): CvItem {
  return {
    id: i.id,
    section: i.section,
    label: i.label,
    detail: opt(i.detail),
    confidence: i.confidence,
    status: i.status,
    origin: i.origin,
  };
}

function toSetup(s: S['SearchSetup']): SearchSetup {
  return {
    targetRole: s.targetRole ?? '',
    location: s.location ?? '',
    salaryMin: opt(s.salaryMin),
    currency: s.currency ?? '',
    salaryPeriod: s.salaryPeriod === 'month' || s.salaryPeriod === 'year' ? s.salaryPeriod : undefined,
    seniority: opt(s.seniority),
    employmentTypes: s.employmentTypes ?? [],
    workModes: s.workModes ?? [],
  };
}

function fromSetup(s: SearchSetup): S['SearchSetup'] {
  const hasSalary = s.salaryMin !== undefined && s.salaryMin > 0;
  return {
    targetRole: s.targetRole,
    location: s.location,
    salaryMin: hasSalary ? s.salaryMin : null,
    currency: hasSalary && s.currency ? s.currency.toUpperCase() : null,
    salaryPeriod: hasSalary ? (s.salaryPeriod ?? null) : null,
    seniority: s.seniority ?? null,
    employmentTypes: s.employmentTypes,
    workModes: s.workModes,
  };
}

function profileCv(p: S['ProfileRead'], notes?: string[]): ParsedCv | null {
  if (!p.cv && p.items.length === 0) return null;
  return {
    fileName: p.cv?.fileName ?? '',
    isSample: false,
    parsedAt: p.cv?.uploadedAt ?? new Date().toISOString(),
    items: p.items.map(toCvItem),
    method: 'basic',
    notes,
  };
}

function jobQueryString(q: JobQuery): string {
  const params = new URLSearchParams();
  if (q.text?.trim()) params.set('q', q.text.trim());
  q.workModes?.forEach((v) => params.append('workModes', v));
  q.employmentTypes?.forEach((v) => params.append('employmentTypes', v));
  q.seniority?.forEach((v) => params.append('seniority', v));
  if (q.minLevel) params.set('minLevel', q.minLevel);
  if (q.savedOnly) params.set('savedOnly', 'true');
  if (q.sort) params.set('sort', q.sort);
  const s = params.toString();
  return s ? `?${s}` : '';
}

const PER_YEAR = { year: 1, month: 12 } as const;

/** Stated yearly top of the range, or undefined when it can't be compared without guessing. */
function statedYearly(job: Job): number | undefined {
  const s = job.salary;
  const top = s?.max ?? s?.min;
  if (!s || top === undefined || (s.period !== 'year' && s.period !== 'month')) return undefined;
  return top * PER_YEAR[s.period];
}

// ---------------------------------------------------------------------------

/** Jobs seen so far, so preparation (on the device) can find the job it was started for. */
const seenJobs = new Map<string, Job>();
const remember = (job: Job) => {
  seenJobs.set(job.id, job);
  return job;
};

export const httpRepository: Repository = {
  profile: {
    sync(input) {
      // Only the on-device drafting engine needs this; the server already has the data.
      local.profile.sync({ setup: input.setup, cvItems: input.cvItems ?? [] });
    },
    async load() {
      const p = await request<S['ProfileRead']>('/profile');
      return { setup: p.setup ? toSetup(p.setup) : undefined, cv: profileCv(p) };
    },
    async saveSetup(setup) {
      return toSetup(await request<S['SearchSetup']>('/profile/setup', { method: 'PUT', body: fromSetup(setup) }));
    },
  },

  cv: {
    async parse(file, onProgress) {
      if (!file.uri) throw new ParsingError('The file could not be opened.', 'unreadable');
      const form = new FormData();
      // React Native's FormData takes a { uri, name, type } object for files.
      form.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
      onProgress?.(0.15);
      let parsed: S['ParsedCv'];
      try {
        parsed = await request<S['ParsedCv']>('/profile/cv', { method: 'POST', body: form, timeoutMs: 120_000 });
      } catch (e) {
        if (e instanceof ApiError && e.status === 422) {
          throw new ParsingError(e.message, e.code === 'unsupported_file' ? 'unsupported' : 'unreadable');
        }
        throw e;
      }
      onProgress?.(0.85);
      // The upload returns only what it found; the review needs every item, old and new.
      const full = await request<S['ProfileRead']>('/profile');
      onProgress?.(1);
      return {
        ...(profileCv(full, parsed.notes) as ParsedCv),
        fileName: parsed.file.fileName,
        parsedAt: parsed.file.uploadedAt,
        method: parsed.method,
      };
    },
    async addItem(input) {
      return toCvItem(
        await request<S['CvItemRead']>('/profile/cv/items', {
          method: 'POST',
          body: { section: input.section, label: input.label, detail: input.detail ?? null },
        }),
      );
    },
    async updateItem(id, patch) {
      const body: Record<string, unknown> = {};
      if (patch.label !== undefined) body.label = patch.label;
      if ('detail' in patch) body.detail = patch.detail ?? null;
      if (patch.status !== undefined) body.status = patch.status;
      return toCvItem(await request<S['CvItemRead']>(`/profile/cv/items/${id}`, { method: 'PATCH', body }));
    },
    async deleteItem(id) {
      await request<void>(`/profile/cv/items/${id}`, { method: 'DELETE' });
    },
  },

  account: {
    exportData() {
      return request<unknown>('/users/me/export');
    },
    async deleteAccount(password) {
      await request<void>('/users/me/delete', { method: 'POST', body: { password } });
    },
  },

  jobs: {
    async list(q = {}) {
      const items = (await request<S['JobListItem'][]>(`/jobs${jobQueryString(q)}`)).map(toListItem);
      items.forEach((i) => remember(i.job));
      // The server doesn't filter on salary; done here with the same rule the filter promises:
      // only jobs that state a comparable salary are kept, none are estimated.
      if (!q.salaryMin) return items;
      return items.filter((i) => (statedYearly(i.job) ?? -1) >= q.salaryMin!);
    },
    async recommended() {
      const items = (await request<S['JobListItem'][]>('/jobs/recommended')).map(toListItem);
      items.forEach((i) => remember(i.job));
      return items;
    },
    async get(id) {
      return remember(toJob(await request<S['JobRead']>(`/jobs/${id}`)));
    },
    async match(id) {
      return toMatch(await request<S['MatchRead']>(`/jobs/${id}/match`));
    },
    async importPreview(url) {
      let p: S['ImportPreview'];
      try {
        p = await request<S['ImportPreview']>('/jobs/import/preview', { method: 'POST', body: { url } });
      } catch (e) {
        if (e instanceof ApiError && e.status === 422) {
          throw new ParsingError(e.message, e.code === 'invalid_url' ? 'invalid_url' : 'unreadable');
        }
        throw e;
      }
      const preview: ImportPreview = {
        url: p.url,
        hostLabel: p.hostLabel,
        title: p.title,
        company: p.company,
        location: p.location,
        workMode: opt(p.workMode),
        employmentType: opt(p.employmentType),
        salary: p.salary ? toSalary(p.salary) : undefined,
        summary: p.summary,
        missing: p.missing,
        // Not saved yet: the server stores it only when the user confirms.
        job: {
          id: `preview:${p.url}`,
          title: p.title,
          company: p.company,
          location: p.location,
          workMode: opt(p.workMode),
          employmentType: opt(p.employmentType),
          seniority: opt(p.seniority),
          salary: p.salary ? toSalary(p.salary) : undefined,
          source: { label: p.hostLabel, url: p.url, kind: 'imported' },
          postedAt: opt(p.postedAt),
          summary: p.summary,
          description: p.description.map((b) => ({ type: b.type, text: b.text, requirement: b.requirement || undefined })),
          skills: p.skills,
        },
      };
      return preview;
    },
    async importConfirm(preview) {
      return remember(toJob(await request<S['JobRead']>('/jobs/import', { method: 'POST', body: { url: preview.url } })));
    },
  },

  applications: {
    async list() {
      return (await request<S['ApplicationRead'][]>('/applications')).map(toApplication);
    },
    async create(job, status) {
      try {
        return toApplication(
          await request<S['ApplicationRead']>('/applications', { method: 'POST', body: { jobId: job.id, status } }),
        );
      } catch (e) {
        // Already tracked (for example saved on another device): move it to the asked status.
        if (!(e instanceof ApiError && e.status === 409)) throw e;
        const existing = (await this.list()).find((a) => a.jobId === job.id);
        if (!existing) throw e;
        return existing.status === status ? existing : this.updateStatus(existing.id, status);
      }
    },
    async updateStatus(id, status) {
      return toApplication(await request<S['ApplicationRead']>(`/applications/${id}`, { method: 'PATCH', body: { status } }));
    },
    async updateNotes(id, notes) {
      return toApplication(await request<S['ApplicationRead']>(`/applications/${id}`, { method: 'PATCH', body: { notes } }));
    },
    async setReminder(id, reminder) {
      const app = reminder
        ? await request<S['ApplicationRead']>(`/applications/${id}/reminder`, {
            method: 'PUT',
            body: { dueAt: reminder.dueAt, note: reminder.note ?? null },
          })
        : await request<S['ApplicationRead']>(`/applications/${id}/reminder`, { method: 'DELETE' });
      return toApplication(app);
    },
    async remove(id) {
      await request<void>(`/applications/${id}`, { method: 'DELETE' });
    },
  },

  prep: {
    async start(job, userName) {
      local.dev.hydrate({ jobs: [seenJobs.get(job.id) ?? job] });
      return local.prep.start(job, userName);
    },
    get: (runId) => local.prep.get(runId),
    retryStep: (runId) => local.prep.retryStep(runId),
    saveDraft: (runId, draft) => local.prep.saveDraft(runId, draft),
    regenerate: (runId, kind, tone) => local.prep.regenerate(runId, kind, tone),
    setCvChange: (runId, changeId, status) => local.prep.setCvChange(runId, changeId, status),
    async requestApproval(runId) {
      const approval = await local.prep.requestApproval(runId);
      // The on-device engine can't know the recruiter's real address, so it isn't shown as one.
      return local.approvals.create({ ...approval, to: undefined });
    },
  },

  approvals: {
    list: () => local.approvals.list(),
    get: (id) => local.approvals.get(id),
    create: (approval) => local.approvals.create(approval),
    cancel: (id) => local.approvals.cancel(id),
    async approve(id) {
      const approval = await local.approvals.get(id);
      const reason = "Email sending isn't connected yet.";
      await local.approvals.create({ ...approval, status: 'failed', failureReason: reason });
      return {
        ok: false,
        message: `Nothing was sent. ${reason} Copy the message from the review screen and send it from your own email.`,
      };
    },
  },

  usage: {
    async get() {
      throw new ApiError('http', "Usage figures aren't available yet.", 501, 'not_available');
    },
  },

  dev: {
    reset: () => local.dev.reset(),
    hydrate: (snapshot) => local.dev.hydrate({ runs: snapshot.runs, approvals: snapshot.approvals, jobs: snapshot.jobs }),
    setSimulateSendFailure: (v) => local.dev.setSimulateSendFailure(v),
    setSimulatePrepFailure: (v) => local.dev.setSimulatePrepFailure(v),
  },
};
