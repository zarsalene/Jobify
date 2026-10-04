/**
 * MOCK document generation. Text is assembled from the user's confirmed CV
 * items and the job post only - never invented. Anything that cannot be tied to
 * the CV is flagged as unverified.
 */
import type { Approval, CvChange, CvItem, Draft, DraftKind, Job } from '../types';
import { hoursFromNow } from './data';

const norm = (s: string) => s.trim().toLowerCase();
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export const TONES = ['formal', 'friendly', 'concise'] as const;
export type Tone = (typeof TONES)[number];

function matchedSkills(job: Job, items: CvItem[]) {
  const have = items.filter((i) => i.section === 'skills').map((i) => i.label);
  const set = new Set(have.map(norm));
  const matched = job.skills.filter((s) => set.has(norm(s)));
  const missing = job.skills.filter((s) => !set.has(norm(s)));
  return { have, matched, missing };
}

export function recruiterAddress(job: Job): string {
  const slug = job.company.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `careers@${slug}.example`;
}

export function buildCoverLetter(job: Job, name: string, items: CvItem[], tone: Tone): Draft {
  const { matched } = matchedSkills(job, items);
  const exp = items.find((i) => i.section === 'experience');
  const skillsLine = matched.length
    ? `My background includes ${matched.slice(0, 4).join(', ')}, which I understand are central to this role.`
    : 'I would like to learn more about the skills this role needs and how my background fits.';
  const expLine = exp
    ? `Most recently I worked as ${exp.label.split(',')[0]}${exp.detail ? `. ${exp.detail}` : '.'}`
    : '';

  const greeting = tone === 'friendly' ? `Hello ${job.company} team,` : `Dear ${job.company} hiring team,`;
  const closing =
    tone === 'friendly'
      ? 'I would love to hear what you think. Thank you for your time!'
      : tone === 'concise'
        ? 'Thank you for your consideration.'
        : 'Thank you for considering my application. I would welcome the opportunity to discuss it further.';
  const intro =
    tone === 'concise'
      ? `I am applying for the ${job.title} role.`
      : `I am writing to apply for the ${job.title} position at ${job.company}. ${job.summary}`;

  const parts = [greeting, intro, skillsLine, expLine, closing, `Kind regards,\n${name}`].filter(Boolean);
  return {
    id: uid('draft'),
    kind: 'cover_letter',
    title: 'Cover letter',
    body: parts.join('\n\n'),
    aiAssisted: true,
    sources: ['your CV', 'job post'],
    updatedAt: new Date().toISOString(),
    edited: false,
    unverifiedNotes: [],
  };
}

export function buildEmail(job: Job, name: string, tone: Tone = 'formal'): Draft {
  const body =
    tone === 'concise'
      ? `Hello,\n\nPlease find my CV and cover letter attached for the ${job.title} role.\n\nThank you,\n${name}`
      : `Hello,\n\nI am interested in the ${job.title} role at ${job.company} and have attached my CV and a short cover letter.\n\nI would be glad to answer any questions.\n\nKind regards,\n${name}`;
  return {
    id: uid('draft'),
    kind: 'email',
    title: 'Recruiter email',
    subject: `Application: ${job.title}`,
    body,
    aiAssisted: true,
    sources: ['your CV', 'job post'],
    updatedAt: new Date().toISOString(),
    edited: false,
  };
}

export function buildCv(job: Job, name: string, items: CvItem[]): { draft: Draft; changes: CvChange[] } {
  const { have, matched, missing } = matchedSkills(job, items);
  const ordered = [...matched, ...have.filter((s) => !matched.map(norm).includes(norm(s)))];
  const exp = items.filter((i) => i.section === 'experience');
  const edu = items.filter((i) => i.section === 'education');
  const cert = items.filter((i) => i.section === 'certifications');

  const summary = matched.length
    ? `Developer with experience in ${matched.slice(0, 3).join(', ')}. Interested in the ${job.title} role.`
    : `Developer interested in the ${job.title} role.`;

  const body = [
    name,
    '',
    'SUMMARY',
    summary,
    '',
    'SKILLS',
    ordered.join(', '),
    '',
    'EXPERIENCE',
    ...exp.map((e) => `${e.label}${e.detail ? `\n${e.detail}` : ''}`),
    '',
    'EDUCATION',
    ...edu.map((e) => `${e.label}${e.detail ? ` (${e.detail})` : ''}`),
    ...(cert.length ? ['', 'CERTIFICATIONS', ...cert.map((c) => c.label)] : []),
  ].join('\n');

  const changes: CvChange[] = [
    {
      id: uid('chg'),
      section: 'Summary',
      before: '(no summary)',
      after: summary,
      reason: `Adds a short summary using only skills found on your CV that the job post also asks for.`,
      status: 'pending',
    },
    {
      id: uid('chg'),
      section: 'Skills',
      before: have.join(', '),
      after: ordered.join(', '),
      reason: 'Moves the skills this job asks for to the front. No skills were added or removed.',
      status: 'pending',
    },
  ];
  if (missing.length) {
    changes.push({
      id: uid('chg'),
      section: 'Skills',
      before: ordered.join(', '),
      after: `${ordered.join(', ')}, ${missing[0]}`,
      reason: `The job asks for ${missing[0]}, but we could not find it on your CV. Accept only if you really have this experience.`,
      status: 'pending',
      unverified: true,
    });
  }

  return {
    draft: {
      id: uid('draft'),
      kind: 'cv',
      title: 'Tailored CV',
      body,
      aiAssisted: true,
      sources: ['your CV', 'job post'],
      updatedAt: new Date().toISOString(),
      edited: false,
      unverifiedNotes: missing.length ? [`${missing[0]} is requested by the job but not found on your CV.`] : [],
    },
    changes,
  };
}

/** Apply accepted CV changes to the CV draft body (simple replace of the skills/summary lines). */
export function applyCvChanges(draft: Draft, changes: CvChange[]): Draft {
  let body = draft.body;
  for (const c of changes) {
    if (c.status === 'accepted') {
      if (c.section === 'Skills' && c.before && body.includes(c.before)) body = body.replace(c.before, c.after);
    }
  }
  return { ...draft, body, updatedAt: new Date().toISOString() };
}

export function buildApproval(
  job: Job,
  drafts: Partial<Record<DraftKind, Draft>>,
  applicationId?: string,
): Approval {
  const email = drafts.email!;
  const attachments = [
    ...(drafts.cv ? [{ name: 'Tailored CV.pdf', sizeKb: 84 }] : []),
    ...(drafts.cover_letter ? [{ name: 'Cover letter.pdf', sizeKb: 42 }] : []),
  ];
  return {
    id: uid('appr'),
    kind: 'send_application',
    permission: 'public',
    actionName: 'Send application email',
    title: 'Ready to send',
    to: recruiterAddress(job),
    subject: email.subject ?? `Application: ${job.title}`,
    body: email.body,
    attachments,
    createdAt: new Date().toISOString(),
    expiresAt: hoursFromNow(23),
    onExpire: 'If you do nothing, this request expires and nothing is sent. Your drafts stay saved.',
    status: 'pending',
    sources: ['your CV', 'job post'],
    jobId: job.id,
    applicationId,
  };
}
