/**
 * Assistant domain types. The assistant is a MOCK today (no real AI): everything
 * is assembled from the user's confirmed CV items, their search preferences and
 * cached jobs, and always carries its sources.
 */
import type { PermissionLevel, StepStatus } from './types';

/** Tasks the assistant can plan. Interview prep has its own screen and is not a task. */
export type TaskKind = 'improve_cv' | 'cover_letter' | 'linkedin_profile' | 'linkedin_post';

/** planning = the plan is shown and waiting for the user's go-ahead. Nothing has run yet. */
export type TaskStatus = 'planning' | 'running' | 'awaiting_approval' | 'done' | 'failed' | 'cancelled';

/** What a step reads. Shown before anything runs. */
export type SourceKey = 'cv' | 'job' | 'prefs';

export type PlanStepKey =
  | 'read_cv'
  | 'read_job'
  | 'read_prefs'
  | 'find_gaps'
  | 'draft_cv'
  | 'draft_letter'
  | 'draft_profile'
  | 'draft_post'
  | 'request_publish';

export interface PlanStep {
  key: PlanStepKey;
  permission: PermissionLevel;
  reads: SourceKey[];
  /** The user can switch optional steps off in "Change plan". */
  optional?: boolean;
  enabled: boolean;
  status: StepStatus;
}

export type TaskFailure = 'offline' | 'job_missing' | 'cv_missing';

export interface TaskResult {
  /** Number of suggestions / items produced. */
  count?: number;
  /** How many of them could not be tied to the CV. */
  unverified?: number;
  /** LinkedIn post draft produced by the plan (used as the approval body). */
  postDraft?: string;
}

export interface AssistantTask {
  id: string;
  kind: TaskKind;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  /** null = general (no specific job). */
  jobId: string | null;
  plan: PlanStep[];
  /** The user chose "Continue in background". */
  background: boolean;
  approvalId?: string;
  result?: TaskResult;
  failure?: TaskFailure;
}

export type ProposalKind = TaskKind | 'interview_prep';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  sources?: SourceKey[];
  /** The assistant suggests a task; the user decides whether to plan it. */
  proposal?: { kind: ProposalKind; jobId?: string | null };
  /** This message carries a task card. */
  taskId?: string;
  /** The reply says the CV has no confirmed items yet. */
  noCv?: boolean;
}

/** One suggested CV edit. Always tied to existing CV items, or flagged unverified. */
export interface CvSuggestion {
  id: string;
  kind: 'summary' | 'skills_order' | 'skill_add' | 'result_prompt';
  section: string;
  before: string;
  after: string;
  reason: string;
  /** The suggestion contains something we cannot find in the CV. */
  unverified?: boolean;
  /** CV items this suggestion is built from. Empty only for unverified additions. */
  cvItemIds: string[];
  /** skill_add: the skill. result_prompt: the experience item id. */
  value?: string;
}

export type SuggestionDecision = 'accepted' | 'rejected';

export interface SavedCvDraft {
  id: string;
  jobId: string | null;
  jobLabel: string;
  createdAt: string;
  text: string;
  acceptedCount: number;
  /** Accepted changes that were flagged unverified. */
  unverifiedCount: number;
}

export type Tone = 'formal' | 'friendly' | 'concise';

export interface LinkedInSuggestion {
  id: string;
  kind: 'headline' | 'about' | 'skills' | 'experience';
  /** Experience entry label, when kind is experience. */
  heading?: string;
  text: string;
  /** Plain-language explanation of what changed and why. */
  why: string;
  sources: SourceKey[];
  /** Something to double-check before using it. */
  unverifiedNote?: string;
}

export interface GeneratedText {
  text: string;
  subject?: string;
  sources: SourceKey[];
  /** Things we could not tie to the CV or the job post. */
  unverifiedNotes: string[];
}
