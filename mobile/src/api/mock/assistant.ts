/**
 * MOCK assistant logic - there is no real AI behind this. Every output is
 * assembled from templates, the user's CONFIRMED CV items, their search
 * preferences and the job post. It never invents experience, skills, employers,
 * results or salary. Anything that cannot be tied to the CV is flagged.
 */
import type { Approval, CvItem, Job, SearchSetup } from '../types';
import type {
  ChatMessage,
  CvSuggestion,
  GeneratedText,
  LinkedInSuggestion,
  PlanStep,
  PlanStepKey,
  ProposalKind,
  SourceKey,
  TaskFailure,
  TaskKind,
  TaskResult,
  Tone,
} from '../types-assistant';
import { t, type TKey } from '@/i18n';

import { hoursFromNow } from './data';

export const TONES: Tone[] = ['formal', 'friendly', 'concise'];

export const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const norm = (s: string) => s.trim().toLowerCase();
const tk = (key: string, params?: Record<string, string | number>) => t(`assistant.${key}` as TKey, params);

// ---------------------------------------------------------------------------
// CV helpers
// ---------------------------------------------------------------------------

/** Only items the user has confirmed are ever used. */
export function confirmedItems(items: CvItem[] | null | undefined): CvItem[] {
  return (items ?? []).filter((i) => i.status === 'confirmed');
}

const skillsOf = (items: CvItem[]) => items.filter((i) => i.section === 'skills');
const expOf = (items: CvItem[]) => items.filter((i) => i.section === 'experience');

function matchSkills(job: Job | undefined, skillLabels: string[]) {
  const have = new Set(skillLabels.map(norm));
  const jobSkills = job?.skills ?? [];
  return {
    matched: jobSkills.filter((s) => have.has(norm(s))),
    missing: jobSkills.filter((s) => !have.has(norm(s))),
  };
}

/** "Mobile Developer, Contoso Sample SARL" -> "Mobile Developer". */
const roleOf = (label: string) => label.split(',')[0].trim();
/** Removes a leading "2021 - 2024." date range from an experience detail. */
const stripDates = (detail: string) => detail.replace(/^\s*\d{4}\s*[-–]\s*(\d{4}|present|now)\s*\.?\s*/i, '').trim();
const hasResult = (detail: string) => /%|\d+\s?(users|customers|clients|k\b)/i.test(stripDates(detail));

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

/** Steps that only make sense when a job is chosen. */
export const JOB_STEPS: PlanStepKey[] = ['read_job', 'find_gaps'];

const step = (key: PlanStepKey, permission: PlanStep['permission'], reads: SourceKey[], optional = false): PlanStep => ({
  key,
  permission,
  reads,
  optional,
  enabled: true,
  status: 'waiting',
});

export function buildPlan(kind: TaskKind): PlanStep[] {
  switch (kind) {
    case 'improve_cv':
      return [
        step('read_cv', 'read', ['cv']),
        step('read_job', 'read', ['job']),
        step('find_gaps', 'read', ['cv', 'job'], true),
        step('draft_cv', 'write', ['cv', 'job']),
      ];
    case 'cover_letter':
      return [step('read_cv', 'read', ['cv']), step('read_job', 'read', ['job']), step('draft_letter', 'write', ['cv', 'job'])];
    case 'linkedin_profile':
      return [step('read_cv', 'read', ['cv']), step('read_prefs', 'read', ['prefs'], true), step('draft_profile', 'write', ['cv', 'prefs'])];
    case 'linkedin_post':
      return [
        step('read_cv', 'read', ['cv']),
        step('read_prefs', 'read', ['prefs'], true),
        step('draft_post', 'write', ['cv']),
        step('request_publish', 'public', ['cv']),
      ];
  }
}

/** Whether the step is part of the plan for this job choice and the user's toggles. */
export function stepActive(s: PlanStep, jobId: string | null): boolean {
  if (JOB_STEPS.includes(s.key) && !jobId) return false;
  return s.enabled;
}

/** Highest permission any active step needs - what the task asks of the user overall. */
export function planPermission(plan: PlanStep[], jobId: string | null): PlanStep['permission'] {
  const order = ['read', 'write', 'public', 'destructive'] as const;
  let top = 0;
  plan.filter((s) => stepActive(s, jobId)).forEach((s) => {
    top = Math.max(top, order.indexOf(s.permission));
  });
  return order[top];
}

export function stepDurationMs(key: PlanStepKey): number {
  switch (key) {
    case 'read_cv':
    case 'read_job':
    case 'read_prefs':
      return 1100;
    case 'find_gaps':
      return 1500;
    default:
      return 1900;
  }
}

/** A step fails honestly when what it needs is gone - nothing is guessed. */
export function checkStep(key: PlanStepKey, ctx: { cvCount: number; jobFound: boolean }): TaskFailure | null {
  if (key === 'read_cv' && ctx.cvCount === 0) return 'cv_missing';
  if (key === 'read_job' && !ctx.jobFound) return 'job_missing';
  return null;
}

export interface GenContext {
  items: CvItem[];
  job?: Job;
  setup?: SearchSetup;
  userName: string;
}

/** What a finished task produced (counts and the post draft). The tools recompute the full content. */
export function summarizeTask(kind: TaskKind, ctx: GenContext): TaskResult {
  switch (kind) {
    case 'improve_cv': {
      const s = suggestCvChanges(ctx.items, ctx.job);
      return { count: s.length, unverified: s.filter((x) => x.unverified).length };
    }
    case 'linkedin_profile': {
      const s = suggestLinkedIn(ctx.items, ctx.setup);
      return { count: s.length, unverified: s.filter((x) => x.unverifiedNote).length };
    }
    case 'linkedin_post':
      return { postDraft: draftPost('', 'friendly', ctx.items, ctx.setup).text };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// CV optimizer
// ---------------------------------------------------------------------------

export function suggestCvChanges(allItems: CvItem[], job?: Job): CvSuggestion[] {
  const items = confirmedItems(allItems);
  const skills = skillsOf(items);
  const labels = skills.map((s) => s.label);
  const { matched, missing } = matchSkills(job, labels);
  const out: CvSuggestion[] = [];

  // 1. Summary built only from skills that are on the CV.
  if (skills.length) {
    const top = (matched.length ? matched : labels).slice(0, 3);
    const topIds = skills.filter((s) => top.some((x) => norm(x) === norm(s.label))).map((s) => s.id);
    out.push({
      id: 'sug_summary',
      kind: 'summary',
      section: tk('secSummary'),
      before: tk('noSummary'),
      after: job
        ? tk('sugSummaryJob', { skills: top.join(', '), title: job.title, company: job.company })
        : tk('sugSummaryGeneral', { skills: top.join(', ') }),
      reason: job ? tk('sugSummaryReasonJob') : tk('sugSummaryReason'),
      cvItemIds: topIds,
    });
  }

  // 2. Put the skills the job asks for first. No skill is added or removed.
  const ordered = [...labels.filter((l) => matched.some((m) => norm(m) === norm(l))), ...labels.filter((l) => !matched.some((m) => norm(m) === norm(l)))];
  const orderChanged = ordered.join('|') !== labels.join('|');
  if (job && orderChanged) {
    out.push({
      id: 'sug_order',
      kind: 'skills_order',
      section: tk('secSkills'),
      before: labels.join(', '),
      after: ordered.join(', '),
      reason: tk('sugOrderReason'),
      cvItemIds: skills.map((s) => s.id),
    });
  }

  // 3. Results prompts: we cannot invent a result, so we ask the user for a real one.
  expOf(items)
    .filter((e) => e.detail && !hasResult(e.detail))
    .slice(0, 2)
    .forEach((e) => {
      out.push({
        id: `sug_result_${e.id}`,
        kind: 'result_prompt',
        section: tk('secExperience', { role: roleOf(e.label) }),
        before: e.detail ?? '',
        after: `${e.detail} ${tk('resultPlaceholder')}`,
        reason: tk('sugResultReason'),
        unverified: true,
        cvItemIds: [e.id],
        value: e.id,
      });
    });

  // 4. Skills the job wants that are NOT on the CV. Flagged; accept only if true.
  const base = ordered.join(', ');
  missing.slice(0, 2).forEach((skill) => {
    out.push({
      id: `sug_add_${norm(skill).replace(/[^a-z0-9]+/g, '_')}`,
      kind: 'skill_add',
      section: tk('secSkills'),
      before: base,
      after: base ? `${base}, ${skill}` : skill,
      reason: tk('sugAddReason', { skill }),
      unverified: true,
      cvItemIds: [],
      value: skill,
    });
  });

  return out;
}

/** Plain-text CV draft with the accepted changes applied. The user's real CV is never touched. */
export function renderCvDraft(allItems: CvItem[], accepted: CvSuggestion[], job?: Job): string {
  const items = confirmedItems(allItems);
  const skills = skillsOf(items).map((s) => s.label);
  const { matched } = matchSkills(job, skills);
  const isMatched = (l: string) => matched.some((m) => norm(m) === norm(l));
  const summary = accepted.find((a) => a.kind === 'summary');
  const reorder = accepted.some((a) => a.kind === 'skills_order');
  const baseSkills = reorder ? [...skills.filter(isMatched), ...skills.filter((l) => !isMatched(l))] : skills;
  const adds = accepted.filter((a) => a.kind === 'skill_add' && a.value).map((a) => a.value as string);
  const finalSkills = [...baseSkills, ...adds.filter((a) => !baseSkills.some((b) => norm(b) === norm(a)))];

  const lines: string[] = [];
  if (summary) lines.push(tk('secSummary').toUpperCase(), summary.after, '');
  if (finalSkills.length) lines.push(tk('secSkills').toUpperCase(), finalSkills.join(', '), '');
  const exp = expOf(items);
  if (exp.length) {
    lines.push(tk('secExperienceHead').toUpperCase());
    exp.forEach((e) => {
      const edit = accepted.find((a) => a.kind === 'result_prompt' && a.value === e.id);
      lines.push(e.label);
      const detail = edit ? edit.after : e.detail;
      if (detail) lines.push(detail);
    });
    lines.push('');
  }
  const edu = items.filter((i) => i.section === 'education');
  if (edu.length) lines.push(tk('secEducation').toUpperCase(), ...edu.map((e) => `${e.label}${e.detail ? ` (${e.detail})` : ''}`), '');
  const cert = items.filter((i) => i.section === 'certifications');
  if (cert.length) lines.push(tk('secCertifications').toUpperCase(), ...cert.map((c) => c.label), '');
  return lines.join('\n').trim();
}

// ---------------------------------------------------------------------------
// Cover letter / email
// ---------------------------------------------------------------------------

export function draftCoverLetter(job: Job, name: string, allItems: CvItem[], tone: Tone, format: 'letter' | 'email'): GeneratedText {
  const items = confirmedItems(allItems);
  const labels = skillsOf(items).map((s) => s.label);
  const { matched, missing } = matchSkills(job, labels);
  const exp = expOf(items)[0];

  const skillsLine = matched.length
    ? tk('clSkills', { skills: matched.slice(0, 4).join(', ') })
    : tk('clNoMatch');
  const expLine = exp
    ? `${tk('clExp', { role: exp.label })}${exp.detail ? ` ${stripDates(exp.detail)}` : ''}`
    : '';

  const unverifiedNotes: string[] = [];
  if (missing.length) unverifiedNotes.push(tk('noteMissingSkills', { skills: missing.slice(0, 4).join(', ') }));
  if (!expLine) unverifiedNotes.push(tk('noteNoExperience'));

  if (format === 'email') {
    const body = [
      tone === 'friendly' ? tk('emHelloFriendly', { company: job.company }) : tk('emHello'),
      tone === 'concise' ? tk('emIntroConcise', { title: job.title }) : tk('emIntro', { title: job.title, company: job.company }),
      tone === 'concise' ? '' : skillsLine,
      tone === 'friendly' ? tk('emCloseFriendly') : tone === 'concise' ? tk('emCloseConcise') : tk('emCloseFormal'),
      tk('signoff', { name }),
    ]
      .filter(Boolean)
      .join('\n\n');
    return { text: body, subject: tk('emSubject', { title: job.title }), sources: ['cv', 'job'], unverifiedNotes };
  }

  const greeting = tone === 'friendly' ? tk('clHelloFriendly', { company: job.company }) : tk('clHello', { company: job.company });
  const intro =
    tone === 'concise'
      ? tk('clIntroConcise', { title: job.title })
      : tk('clIntro', { title: job.title, company: job.company });
  const closing = tone === 'friendly' ? tk('clCloseFriendly') : tone === 'concise' ? tk('clCloseConcise') : tk('clCloseFormal');
  const parts = [greeting, intro, skillsLine, tone === 'concise' ? '' : expLine, closing, tk('signoff', { name })].filter(Boolean);
  return { text: parts.join('\n\n'), sources: ['cv', 'job'], unverifiedNotes };
}

// ---------------------------------------------------------------------------
// LinkedIn profile
// ---------------------------------------------------------------------------

export function suggestLinkedIn(allItems: CvItem[], setup?: SearchSetup): LinkedInSuggestion[] {
  const items = confirmedItems(allItems);
  const skills = skillsOf(items);
  const labels = skills.map((s) => s.label);
  const exp = expOf(items);
  const out: LinkedInSuggestion[] = [];
  const role = setup?.targetRole?.trim() || (exp[0] ? roleOf(exp[0].label) : '');
  const prefs: SourceKey[] = setup?.targetRole ? ['prefs'] : [];

  if (role || labels.length) {
    out.push({
      id: 'li_headline',
      kind: 'headline',
      text: [role, labels.slice(0, 3).join(' | ')].filter(Boolean).join(' | '),
      why: tk('liHeadlineWhy'),
      sources: ['cv', ...prefs],
    });
  }

  const aboutParts = [
    labels.length ? tk('liAboutSkills', { skills: labels.slice(0, 5).join(', ') }) : '',
    exp[0] ? `${tk('clExp', { role: exp[0].label })}${exp[0].detail ? ` ${stripDates(exp[0].detail)}` : ''}` : '',
    setup?.targetRole
      ? setup.location
        ? tk('liAboutLooking', { role: setup.targetRole, location: setup.location })
        : tk('liAboutLookingNoLoc', { role: setup.targetRole })
      : '',
  ].filter(Boolean);
  if (aboutParts.length) {
    out.push({
      id: 'li_about',
      kind: 'about',
      text: aboutParts.join('\n\n'),
      why: tk('liAboutWhy'),
      sources: ['cv', ...prefs],
    });
  }

  if (labels.length) {
    const low = skills.filter((s) => s.confidence < 0.7).length;
    out.push({
      id: 'li_skills',
      kind: 'skills',
      text: labels.slice(0, 10).join(', '),
      why: tk('liSkillsWhy'),
      sources: ['cv'],
      unverifiedNote: low ? tk('liSkillsLow', { count: low }) : undefined,
    });
  }

  exp
    .filter((e) => e.detail)
    .slice(0, 3)
    .forEach((e) => {
      const bullets = stripDates(e.detail ?? '')
        .split(/[.;]\s+/)
        .map((b) => b.replace(/\.$/, '').trim())
        .filter(Boolean)
        .map((b) => `• ${b}`);
      out.push({
        id: `li_exp_${e.id}`,
        kind: 'experience',
        heading: e.label,
        text: bullets.join('\n'),
        why: tk('liExpWhy'),
        sources: ['cv'],
        unverifiedNote: hasResult(e.detail ?? '') ? undefined : tk('liNoMetric'),
      });
    });

  return out;
}

// ---------------------------------------------------------------------------
// LinkedIn post
// ---------------------------------------------------------------------------

export function draftPost(topic: string, tone: Tone, allItems: CvItem[], setup?: SearchSetup): GeneratedText {
  const items = confirmedItems(allItems);
  const labels = skillsOf(items).map((s) => s.label);
  const exp = expOf(items)[0];
  const subject = topic.trim();
  const topSkills = labels.slice(0, 3);

  const opening = subject
    ? tone === 'friendly'
      ? tk('postOpenFriendly', { topic: subject })
      : tone === 'concise'
        ? tk('postOpenConcise', { topic: subject })
        : tk('postOpenFormal', { topic: subject })
    : topSkills.length
      ? tk('postOpenDefault', { skills: topSkills.join(', ') })
      : tk('postOpenEmpty');
  const skillsLine = topSkills.length && subject ? tk('postSkills', { skills: topSkills.join(', ') }) : '';
  const expLine = exp && tone !== 'concise' ? tk('postExp', { role: roleOf(exp.label) }) : '';
  const closing = tone === 'friendly' ? tk('postCloseFriendly') : tone === 'formal' ? tk('postCloseFormal') : '';
  const tags = topSkills
    .map((s) => `#${s.replace(/[^A-Za-z0-9]/g, '')}`)
    .filter((x) => x.length > 1)
    .join(' ');

  const unverifiedNotes: string[] = [];
  if (subject) {
    const corpus = items.map((i) => `${i.label} ${i.detail ?? ''}`.toLowerCase()).join(' ');
    const words = subject.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    if (!words.some((w) => corpus.includes(w))) unverifiedNotes.push(tk('notePostTopic', { topic: subject }));
  }
  void setup;
  return {
    text: [opening, skillsLine, expLine, closing, tags].filter(Boolean).join('\n\n'),
    sources: ['cv'],
    unverifiedNotes,
  };
}

/** The approval that gates publishing. Nothing is published by building it. */
export function buildPostApproval(draft: string, sources: string[]): Approval {
  return {
    id: uid('appr_post'),
    kind: 'publish_post',
    permission: 'public',
    actionName: tk('postActionName'),
    title: tk('postApprovalTitle'),
    body: draft,
    attachments: [],
    createdAt: new Date().toISOString(),
    expiresAt: hoursFromNow(23),
    onExpire: tk('postOnExpire'),
    status: 'pending',
    sources,
  };
}

// ---------------------------------------------------------------------------
// Chat replies
// ---------------------------------------------------------------------------

export interface Reply {
  text: string;
  sources?: SourceKey[];
  proposal?: ChatMessage['proposal'];
  noCv?: boolean;
}

/** Canned keyword routing. No model: the reply only points to things the assistant can really do. */
export function replyTo(input: string, cvCount: number): Reply {
  const q = input.toLowerCase();
  const has = (...w: string[]) => w.some((x) => q.includes(x));
  const propose = (kind: ProposalKind, key: string, needsCv = true): Reply => {
    if (needsCv && cvCount === 0) return { text: tk('replyNoCv'), noCv: true };
    return { text: tk(key), proposal: { kind }, sources: needsCv ? ['cv'] : undefined };
  };

  if (has('delete', 'remove my', 'erase', 'supprim')) return { text: tk('replyDelete') };
  if (has('salary', 'salaire', 'how much', 'pay ')) return { text: tk('replySalary') };
  if (has('linkedin') && has('post', 'publish', 'publi')) return propose('linkedin_post', 'replyPost');
  if (has('linkedin')) return propose('linkedin_profile', 'replyLinkedIn');
  if (has('cover', 'letter', 'lettre')) return propose('cover_letter', 'replyCover');
  if (has('interview', 'entretien')) return { text: tk('replyInterview'), proposal: { kind: 'interview_prep' } };
  if (has('cv', 'resume', 'résumé')) return propose('improve_cv', 'replyCv');
  return { text: tk('replyFallback') };
}
