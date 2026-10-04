/**
 * API + domain types.
 *
 * Auth types mirror the backend schemas exactly (backend/app/schemas/auth.py,
 * user.py). Everything else is the contract the mock repository implements and
 * that real endpoints are expected to follow later.
 */

// ---------------------------------------------------------------------------
// Auth (REAL - backed by /api/v1/auth/* and /api/v1/users/me)
// ---------------------------------------------------------------------------

export interface RegisterRequest {
  email: string;
  /** min 8, max 128 */
  password: string;
  /** min 1, max 200 */
  full_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  /** seconds */
  expires_in: number;
}

export interface UserRead {
  id: string;
  email: string;
  full_name: string;
}

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship';
export type Seniority = 'intern' | 'junior' | 'mid' | 'senior' | 'lead';
export type MatchLevel = 'strong' | 'good' | 'partial' | 'weak';

/** What an action is allowed to do. Shown on every approval. */
export type PermissionLevel = 'read' | 'write' | 'public' | 'destructive';

// ---------------------------------------------------------------------------
// Profile & CV
// ---------------------------------------------------------------------------

export interface SearchSetup {
  targetRole: string;
  location: string;
  /** Optional. Never guessed. */
  salaryMin?: number;
  currency: string;
  /** Required by the server whenever salaryMin is set. */
  salaryPeriod?: 'month' | 'year';
  seniority?: Seniority;
  employmentTypes: EmploymentType[];
  workModes: WorkMode[];
}

export type CvSection = 'skills' | 'experience' | 'education' | 'certifications';

export interface CvItem {
  id: string;
  section: CvSection;
  label: string;
  detail?: string;
  /** 0..1 extraction confidence. Below 0.7 is flagged for review. */
  confidence: number;
  status: 'pending' | 'confirmed';
  /** 'cv' = found in an upload, 'manual' = typed by the user. */
  origin?: 'cv' | 'manual';
}

export interface ParsedCv {
  fileName: string;
  /** True while parsing is mocked - the file is not actually read yet. */
  isSample?: boolean;
  parsedAt: string;
  items: CvItem[];
  /** 'basic' = skill names matched in the file's text; 'ai' = read by a model. */
  method?: 'sample' | 'basic' | 'ai';
  /** Plain-language notes about what was and wasn't extracted. */
  notes?: string[];
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export interface Salary {
  min?: number;
  max?: number;
  /** Missing when the posting gave the salary only as free text (see `text`). */
  currency?: string;
  period?: 'year' | 'month' | 'day' | 'hour';
  /** The posting's own words, when the amount couldn't be read as numbers. */
  text?: string;
  /** Where the number comes from, e.g. "Stated in the original posting". Always shown. */
  source: string;
}

export interface JobSource {
  /** Human label, e.g. "Sample feed" or "Imported from link". */
  label: string;
  url: string;
  kind: 'feed' | 'imported';
}

export interface DescriptionBlock {
  type: 'heading' | 'paragraph' | 'bullet';
  text: string;
  /** Highlighted as a requirement in the job detail. */
  requirement?: boolean;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  /** Undefined when the posting doesn't say. Never assumed. */
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  seniority?: Seniority;
  /** Only present if the source stated one. */
  salary?: Salary;
  source: JobSource;
  postedAt?: string;
  summary: string;
  description: DescriptionBlock[];
  /** Required skills pulled from the post. */
  skills: string[];
}

export interface JobQuery {
  text?: string;
  workModes?: WorkMode[];
  employmentTypes?: EmploymentType[];
  seniority?: Seniority[];
  /** Only jobs that state a salary at or above this. */
  salaryMin?: number;
  minLevel?: MatchLevel;
  savedOnly?: boolean;
  sort?: 'best_match' | 'newest';
}

export type FactorStatus = 'good' | 'ok' | 'poor' | 'unknown';

export type FactorKey =
  | 'location'
  | 'salary'
  | 'seniority'
  | 'employment_type'
  | 'required_skills'
  | 'skill_equivalence'
  | 'experience_relevance'
  | 'career_alignment';

export interface MatchFactor {
  key: FactorKey;
  label: string;
  status: FactorStatus;
  detail: string;
}

export interface MatchGap {
  label: string;
  howToClose: string;
}

export interface MatchResult {
  jobId: string;
  /** 0..100 */
  score: number;
  level: MatchLevel;
  /** One or two plain sentences. */
  reason: string;
  strengths: string[];
  gaps: MatchGap[];
  factors: {
    /** Rule-based, reproducible. */
    deterministic: MatchFactor[];
    /** Model-based judgement, flagged as AI. */
    ai: MatchFactor[];
  };
  basedOn: string[];
  generatedAt: string;
}

export interface ImportPreview {
  url: string;
  hostLabel: string;
  title: string;
  company: string;
  location: string;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  salary?: Salary;
  summary: string;
  /** Fields the parser could not find - shown as "Not found" rather than guessed. */
  missing: string[];
  job: Job;
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export type ApplicationStatus = 'saved' | 'preparing' | 'applied' | 'interview' | 'offer' | 'rejected';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'saved',
  'preparing',
  'applied',
  'interview',
  'offer',
  'rejected',
];

export interface TimelineEvent {
  id: string;
  at: string;
  kind: 'saved' | 'prepared' | 'approved' | 'sent' | 'status' | 'note' | 'reminder';
  text: string;
}

export interface Reminder {
  dueAt: string;
  note?: string;
}

export interface Application {
  id: string;
  /** Undefined if the job was later removed from the feed; title and company are kept. */
  jobId?: string;
  jobTitle: string;
  company: string;
  location: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  notes: string;
  reminder?: Reminder;
  timeline: TimelineEvent[];
  /** Names of documents used for this application. */
  documents: { id: string; kind: DraftKind; name: string }[];
  matchScore?: number;
  matchLevel?: MatchLevel;
}

// ---------------------------------------------------------------------------
// Application preparation
// ---------------------------------------------------------------------------

export type PrepStepKey = 'job_analyzed' | 'cv_analyzed' | 'cover_letter' | 'recruiter_email';
export type StepStatus = 'waiting' | 'in_progress' | 'done' | 'failed';

export interface PrepStep {
  key: PrepStepKey;
  status: StepStatus;
}

export type DraftKind = 'cv' | 'cover_letter' | 'email';

export interface Draft {
  id: string;
  kind: DraftKind;
  title: string;
  subject?: string;
  body: string;
  aiAssisted: boolean;
  /** Shown as "Based on: ..." */
  sources: string[];
  updatedAt: string;
  edited: boolean;
  /** Claims the AI could not tie to the CV or job post. */
  unverifiedNotes?: string[];
}

export interface CvChange {
  id: string;
  section: string;
  before: string;
  after: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  /** True when the suggestion adds something we cannot find in the original CV. */
  unverified?: boolean;
}

export interface PrepRun {
  id: string;
  jobId: string;
  steps: PrepStep[];
  startedAt: string;
  drafts: Partial<Record<DraftKind, Draft>>;
  cvChanges: CvChange[];
  approvalId?: string;
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export type ApprovalStatus = 'pending' | 'sent' | 'cancelled' | 'expired' | 'failed';
export type ApprovalKind = 'send_application' | 'publish_post' | 'assistant_action';

export interface Approval {
  id: string;
  kind: ApprovalKind;
  permission: PermissionLevel;
  /** e.g. "Send application email" */
  actionName: string;
  title: string;
  to?: string;
  subject?: string;
  body: string;
  attachments: { name: string; sizeKb?: number }[];
  createdAt: string;
  expiresAt: string;
  /** Plain-language consequence of letting it lapse. */
  onExpire: string;
  status: ApprovalStatus;
  sources: string[];
  jobId?: string;
  applicationId?: string;
  failureReason?: string;
}

export interface SendResult {
  ok: boolean;
  /** When !ok the message must say nothing was sent. */
  message: string;
  sentAt?: string;
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

export interface UsageInfo {
  plan: string;
  aiRuns: { used: number; limit: number };
  applications: { used: number; limit: number };
  resetsAt: string;
}
