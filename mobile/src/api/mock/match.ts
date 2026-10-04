/**
 * MOCK matching. The deterministic factors are real, reproducible rules over the
 * user's setup + confirmed CV skills. The "AI" factors are simple stand-ins
 * (equivalence map + heuristics) that mimic the shape of a model response.
 */
import type {
  FactorStatus,
  Job,
  MatchFactor,
  MatchGap,
  MatchLevel,
  MatchResult,
  SearchSetup,
  Seniority,
} from '../types';

export function levelForScore(score: number): MatchLevel {
  if (score >= 80) return 'strong';
  if (score >= 65) return 'good';
  if (score >= 45) return 'partial';
  return 'weak';
}

const LADDER: Seniority[] = ['intern', 'junior', 'mid', 'senior', 'lead'];

const EQUIVALENTS: Record<string, string[]> = {
  cypress: ['jest'],
  playwright: ['jest'],
  'next.js': ['react'],
  vue: ['react'],
  expo: ['react native'],
  graphql: ['rest apis'],
  express: ['node.js'],
  redux: ['react'],
  'power bi': ['sql'],
  excel: ['sql'],
};

const GAP_TIPS: Record<string, string> = {
  'next.js': 'Next.js builds on React. A small server-rendered side project, listed on your CV, would show you can work with it.',
  graphql: 'If you have called GraphQL APIs before, add where you used them. Otherwise the official tutorial is a short way to get started.',
  python: 'If you have used Python for scripts or services, say so on your CV. If not, this is a larger gap than it looks.',
  fastapi: 'FastAPI is quick to pick up if you know Python. Only list it once you have built something with it.',
  postgresql: 'If your SQL experience was on PostgreSQL, name it explicitly on your CV.',
  docker: 'A small containerised project would let you add Docker to your CV honestly.',
  kubernetes: 'This is a significant gap for the role. It may help to ask the recruiter how much is required day to day.',
  'power bi': 'If you used another BI tool, mention it. Power BI has a free desktop version you can learn with.',
  cypress: 'Your Jest testing is related. Adding an end-to-end test project would show the next step.',
  playwright: 'Your Jest testing is related. A small Playwright suite on a personal project would close most of this gap.',
  accessibility: 'If you have worked on accessibility, add concrete examples. If not, the WCAG quick reference is a good start.',
  'user research': 'Share any interviews or usability tests you have run, even small ones.',
  'people management': 'If you have led people informally (mentoring, tech lead), describe it. Formal management experience cannot be inferred.',
  figma: 'Add your Figma experience only if you have actually used it for design work.',
  animations: 'If you built animated interactions in React Native, add one concrete example to your CV.',
};

const norm = (s: string) => s.trim().toLowerCase();

function statusPoints(s: FactorStatus): number | null {
  switch (s) {
    case 'good':
      return 1;
    case 'ok':
      return 0.6;
    case 'poor':
      return 0.15;
    default:
      return null;
  }
}

export function computeMatch(job: Job, setup: SearchSetup | undefined, cvSkills: string[]): MatchResult {
  const have = new Set(cvSkills.map(norm));
  const required = job.skills;

  const matched: string[] = [];
  const equivalent: { skill: string; via: string }[] = [];
  const missing: string[] = [];
  for (const sk of required) {
    if (have.has(norm(sk))) matched.push(sk);
    else {
      const via = (EQUIVALENTS[norm(sk)] ?? []).find((e) => have.has(e));
      if (via) equivalent.push({ skill: sk, via });
      else missing.push(sk);
    }
  }
  const ratio = required.length ? (matched.length + equivalent.length * 0.5) / required.length : 0;

  // ---- Deterministic factors --------------------------------------------
  const loc = norm(setup?.location ?? '');
  let locationStatus: FactorStatus = 'unknown';
  let locationDetail = 'You have not set a preferred location.';
  if (job.workMode === 'remote') {
    locationStatus = 'good';
    locationDetail = 'Remote role, so location should not be a blocker. Check the posting for time zone limits.';
  } else if (loc && norm(job.location).includes(loc)) {
    locationStatus = 'good';
    locationDetail = `Based in ${job.location}, which matches your preference.`;
  } else if (loc) {
    locationStatus = job.workMode === 'hybrid' ? 'poor' : 'poor';
    locationDetail = `${job.location} is not where you said you want to work (${setup?.location}).`;
  }

  let salaryStatus: FactorStatus = 'unknown';
  let salaryDetail = 'No salary is stated in this posting, so we have not scored it and have not guessed one.';
  if (job.salary) {
    const top = job.salary.max ?? job.salary.min;
    if (setup?.salaryMin && top) {
      const yearly = job.salary.period === 'year' ? top : job.salary.period === 'month' ? top * 12 : top * 220;
      salaryStatus = yearly >= setup.salaryMin ? 'good' : 'poor';
      salaryDetail =
        salaryStatus === 'good'
          ? 'The stated range reaches your minimum.'
          : 'The stated range is below the minimum you set.';
    } else {
      salaryStatus = 'unknown';
      salaryDetail = 'A salary is stated, but you have not set a minimum to compare it with.';
    }
  }

  let seniorityStatus: FactorStatus = 'unknown';
  let seniorityDetail = 'You have not set a seniority.';
  if (setup?.seniority) {
    const d = Math.abs(LADDER.indexOf(setup.seniority) - LADDER.indexOf(job.seniority));
    seniorityStatus = d === 0 ? 'good' : d === 1 ? 'ok' : 'poor';
    seniorityDetail =
      d === 0
        ? 'The level matches what you are looking for.'
        : d === 1
          ? 'One level away from what you are looking for.'
          : 'Quite far from the level you are looking for.';
  }

  let employmentStatus: FactorStatus = 'unknown';
  let employmentDetail = 'You have not set an employment type.';
  if (setup?.employmentTypes?.length) {
    const ok = setup.employmentTypes.includes(job.employmentType);
    employmentStatus = ok ? 'good' : 'poor';
    employmentDetail = ok ? 'Matches the employment type you chose.' : 'Different from the employment type you chose.';
  }

  const skillsStatus: FactorStatus = !required.length ? 'unknown' : ratio >= 0.7 ? 'good' : ratio >= 0.4 ? 'ok' : 'poor';
  const skillsDetail = required.length
    ? `${matched.length} of ${required.length} required skills appear on your CV${
        equivalent.length ? `, and ${equivalent.length} more have a close equivalent` : ''
      }.`
    : 'The posting does not list specific skills.';

  const deterministic: MatchFactor[] = [
    { key: 'required_skills', label: 'Required skills', status: skillsStatus, detail: skillsDetail },
    { key: 'seniority', label: 'Seniority', status: seniorityStatus, detail: seniorityDetail },
    { key: 'location', label: 'Location', status: locationStatus, detail: locationDetail },
    { key: 'employment_type', label: 'Employment type', status: employmentStatus, detail: employmentDetail },
    { key: 'salary', label: 'Salary', status: salaryStatus, detail: salaryDetail },
  ];
  const weights: Record<string, number> = {
    required_skills: 3,
    seniority: 2,
    location: 1.5,
    employment_type: 1,
    salary: 1,
  };

  // ---- AI-style factors (mock heuristics) -------------------------------
  const eqStatus: FactorStatus = equivalent.length ? 'good' : missing.length ? 'poor' : 'ok';
  const equivalenceDetail = equivalent.length
    ? equivalent.map((e) => `${e.skill}: your ${e.via} experience is related`).join('; ') + '. Related is not the same, so check the posting.'
    : missing.length
      ? 'We found no close equivalents on your CV for the missing skills.'
      : 'Nothing needed to be matched by equivalence.';

  const hasExperience = cvSkills.length > 0;
  const expStatus: FactorStatus = !hasExperience ? 'unknown' : ratio >= 0.6 ? 'good' : ratio >= 0.35 ? 'ok' : 'poor';
  const expDetail = hasExperience
    ? 'Compared the responsibilities in the post with the experience entries you confirmed.'
    : 'Confirm your CV to compare experience.';

  const roleTokens = norm(setup?.targetRole ?? '').split(/\s+/).filter((w) => w.length > 2);
  const titleHit = roleTokens.some((w) => norm(job.title).includes(w));
  const careerStatus: FactorStatus = !roleTokens.length ? 'unknown' : titleHit ? 'good' : 'ok';
  const careerDetail = !roleTokens.length
    ? 'Set a target role to see how this fits your direction.'
    : titleHit
      ? `The title lines up with your target role (${setup?.targetRole}).`
      : `The title differs from your target role (${setup?.targetRole}), so this may be a sideways step.`;

  const ai: MatchFactor[] = [
    { key: 'skill_equivalence', label: 'Skill equivalence', status: eqStatus, detail: equivalenceDetail },
    { key: 'experience_relevance', label: 'Experience relevance', status: expStatus, detail: expDetail },
    { key: 'career_alignment', label: 'Career alignment', status: careerStatus, detail: careerDetail },
  ];
  ai.forEach((f) => (weights[f.key] = 1));

  // ---- Score -------------------------------------------------------------
  let total = 0;
  let weightSum = 0;
  for (const f of [...deterministic, ...ai]) {
    const p = statusPoints(f.status);
    if (p === null) continue;
    total += p * (weights[f.key] ?? 1);
    weightSum += weights[f.key] ?? 1;
  }
  const score = weightSum ? Math.round((total / weightSum) * 100) : 0;
  const level = levelForScore(score);

  // ---- Strengths / gaps --------------------------------------------------
  const strengths: string[] = matched.slice(0, 4).map((s) => `${s} on your CV`);
  if (locationStatus === 'good') strengths.push(job.workMode === 'remote' ? 'Remote-friendly' : 'Location matches');
  if (seniorityStatus === 'good') strengths.push('Level matches');
  if (employmentStatus === 'good') strengths.push('Employment type matches');

  const gaps: MatchGap[] = missing.slice(0, 4).map((s) => ({
    label: s,
    howToClose:
      GAP_TIPS[norm(s)] ??
      `If you have real experience with ${s}, add it to your CV. If not, a short project could show you are learning it. We will not add it for you.`,
  }));
  equivalent.forEach((e) =>
    gaps.push({
      label: `${e.skill} (related, not listed)`,
      howToClose: GAP_TIPS[norm(e.skill)] ?? `Your ${e.via} experience is related. Name ${e.skill} only if you have used it.`,
    }),
  );
  if (locationStatus === 'poor') {
    gaps.push({ label: 'Location', howToClose: 'Ask the recruiter whether relocation or remote days are possible before applying.' });
  }
  if (seniorityStatus === 'poor') {
    gaps.push({ label: 'Seniority gap', howToClose: 'The level is far from your target. Consider whether this is a stretch role worth your time.' });
  }

  const reason = (() => {
    const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
    const skillsPart = matched.length
      ? `Your CV covers ${list(matched.slice(0, 3))}, which this post asks for.`
      : 'Few of the skills this post asks for appear on your CV.';
    const fits = [
      locationStatus === 'good' ? (job.workMode === 'remote' ? 'remote work' : 'location') : '',
      seniorityStatus === 'good' ? 'level' : '',
      employmentStatus === 'good' ? 'employment type' : '',
    ].filter(Boolean);
    const fitPart = fits.length ? ` ${list(fits).replace(/^./, (c) => c.toUpperCase())} match your preferences.` : '';
    const gapPart = gaps[0] ? ` The biggest gap is ${gaps[0].label}.` : ' No major gaps found.';
    return `${skillsPart}${fitPart}${gapPart}`;
  })();

  return {
    jobId: job.id,
    score,
    level,
    reason,
    strengths: strengths.slice(0, 6),
    gaps: gaps.slice(0, 5),
    factors: { deterministic, ai },
    basedOn: ['your CV', 'your search preferences', 'job post'],
    generatedAt: new Date().toISOString(),
  };
}
