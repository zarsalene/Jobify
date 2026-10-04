/**
 * Assistant state: conversation, tasks (plan -> run -> approval) and locally
 * saved CV drafts. Persisted to AsyncStorage. The assistant is a mock - see
 * src/api/mock/assistant.ts. Nothing here ever sends or publishes anything:
 * the only outward action (publishing a LinkedIn post) is registered as a
 * pending Approval and executed, if at all, from the approval screen.
 */
import { useMemo } from 'react';

import {
  buildPlan,
  buildPostApproval,
  checkStep,
  confirmedItems,
  replyTo,
  stepActive,
  stepDurationMs,
  summarizeTask,
  uid,
  type GenContext,
} from '@/api/mock/assistant';
import type { Approval } from '@/api/types';
import type { AssistantTask, ChatMessage, PlanStepKey, SavedCvDraft, TaskFailure, TaskKind } from '@/api/types-assistant';
import { t, type TKey } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { isOnline } from '@/lib/network';
import { createStore, persistStore } from '@/lib/store';

import { data, registerApproval } from './data';
import { profile } from './profile';
import { session } from './session';

export interface AssistantState {
  hydrated: boolean;
  /** The assistant is "typing" a canned reply. Not persisted. */
  thinking: boolean;
  messages: ChatMessage[];
  tasks: Record<string, AssistantTask>;
  drafts: SavedCvDraft[];
}

export const assistant = createStore<AssistantState>({
  hydrated: false,
  thinking: false,
  messages: [],
  tasks: {},
  drafts: [],
});

const MAX_MESSAGES = 80;
const MAX_DRAFTS = 10;
const tk = (key: string, params?: Record<string, string | number>) => t(`assistant.${key}` as TKey, params);

// --- Lifecycle ----------------------------------------------------------------

let hydration: Promise<void> | null = null;

/** Idempotent. Screens call this on mount; init.ts may call it too. */
export function ensureAssistantHydrated(): Promise<void> {
  if (!hydration) {
    hydration = persistStore(assistant, 'rolenest.assistant.v1', ['messages', 'tasks', 'drafts'])
      .catch(() => {
        /* never block the screen on storage trouble */
      })
      .then(() => {
        assistant.set({ hydrated: true });
        resumeRunning();
      });
  }
  return hydration;
}
export const hydrateAssistant = ensureAssistantHydrated;

/** Call on sign-out. */
export function resetAssistant() {
  timers.forEach((h) => clearTimeout(h));
  timers.clear();
  assistant.set({ messages: [], tasks: {}, drafts: [], thinking: false });
}

// --- Helpers -----------------------------------------------------------------

function cvItems() {
  return confirmedItems(profile.get().cv?.items);
}

function genContext(task?: AssistantTask): GenContext {
  const p = profile.get();
  return {
    items: confirmedItems(p.cv?.items),
    job: task?.jobId ? data.get().jobs[task.jobId] : undefined,
    setup: p.setup,
    userName: session.get().user?.full_name?.trim() || tk('namePlaceholder'),
  };
}

export function taskTitle(kind: TaskKind): string {
  return tk(`task_${kind}`);
}

function pushMessage(m: Omit<ChatMessage, 'id' | 'at'>): ChatMessage {
  const msg: ChatMessage = { ...m, id: uid('msg'), at: new Date().toISOString() };
  const s = assistant.get();
  const messages = [...s.messages, msg].slice(-MAX_MESSAGES);
  const referenced = new Set(messages.map((x) => x.taskId).filter(Boolean) as string[]);
  const tasks: Record<string, AssistantTask> = {};
  Object.values(s.tasks).forEach((task) => {
    if (referenced.has(task.id)) tasks[task.id] = task;
    else {
      const h = timers.get(task.id);
      if (h) clearTimeout(h);
      timers.delete(task.id);
    }
  });
  assistant.set({ messages, tasks });
  return msg;
}

function patchTask(id: string, patch: Partial<AssistantTask> | ((t: AssistantTask) => Partial<AssistantTask>)) {
  const s = assistant.get();
  const cur = s.tasks[id];
  if (!cur) return;
  const p = typeof patch === 'function' ? patch(cur) : patch;
  assistant.set({ tasks: { ...s.tasks, [id]: { ...cur, ...p, updatedAt: new Date().toISOString() } } });
}

function setStep(id: string, key: PlanStepKey, status: AssistantTask['plan'][number]['status']) {
  patchTask(id, (task) => ({ plan: task.plan.map((s) => (s.key === key ? { ...s, status } : s)) }));
}

// --- Chat ---------------------------------------------------------------------

/** User types a message. The reply is canned (mock) and only points to things the assistant can really do. */
export function sendUserMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || !isOnline()) return false;
  pushMessage({ role: 'user', text: trimmed });
  assistant.set({ thinking: true });
  setTimeout(() => {
    const r = replyTo(trimmed, cvItems().length);
    pushMessage({ role: 'assistant', text: r.text, sources: r.sources, proposal: r.proposal, noCv: r.noCv });
    assistant.set({ thinking: false });
  }, 700);
  return true;
}

/** A suggested-task chip: shows what the user asked for, then the plan. */
export function proposeTask(kind: TaskKind): string | null {
  pushMessage({ role: 'user', text: taskTitle(kind) });
  return startPlan(kind);
}

/** The user accepted a proposal in a reply. */
export function acceptProposal(messageId: string): string | null {
  const m = assistant.get().messages.find((x) => x.id === messageId);
  if (!m?.proposal || m.proposal.kind === 'interview_prep') return null;
  const kind = m.proposal.kind;
  assistant.set({ messages: assistant.get().messages.map((x) => (x.id === messageId ? { ...x, proposal: undefined } : x)) });
  return startPlan(kind, m.proposal.jobId ?? null);
}

// --- Plans & tasks ---------------------------------------------------------------

/** Shows a plan. Nothing runs until the user confirms it. */
export function startPlan(kind: TaskKind, jobId: string | null = null): string | null {
  if (!cvItems().length) {
    pushMessage({ role: 'assistant', text: tk('replyNoCv'), noCv: true });
    return null;
  }
  const now = new Date().toISOString();
  const task: AssistantTask = {
    id: uid('task'),
    kind,
    status: 'planning',
    createdAt: now,
    updatedAt: now,
    jobId,
    plan: buildPlan(kind),
    background: false,
  };
  assistant.set({ tasks: { ...assistant.get().tasks, [task.id]: task } });
  pushMessage({ role: 'assistant', text: tk('planIntro', { title: taskTitle(kind) }), taskId: task.id, sources: ['cv'] });
  return task.id;
}

export function setTaskJob(id: string, jobId: string | null) {
  const task = assistant.get().tasks[id];
  if (task?.status === 'planning') patchTask(id, { jobId });
}

export function toggleStep(id: string, key: PlanStepKey) {
  const task = assistant.get().tasks[id];
  if (task?.status !== 'planning') return;
  patchTask(id, { plan: task.plan.map((s) => (s.key === key && s.optional ? { ...s, enabled: !s.enabled } : s)) });
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** "Looks good, start". The only way a plan begins to run. */
export function confirmPlan(id: string): boolean {
  const task = assistant.get().tasks[id];
  if (!task || task.status !== 'planning' || !isOnline()) return false;
  patchTask(id, { status: 'running', failure: undefined, plan: task.plan.map((s) => ({ ...s, status: 'waiting' as const })) });
  advance(id);
  return true;
}

export function cancelTask(id: string) {
  const task = assistant.get().tasks[id];
  if (!task || (task.status !== 'planning' && task.status !== 'running')) return;
  const h = timers.get(id);
  if (h) clearTimeout(h);
  timers.delete(id);
  patchTask(id, {
    status: 'cancelled',
    plan: task.plan.map((s) => (s.status === 'in_progress' ? { ...s, status: 'waiting' as const } : s)),
  });
}

export function setBackground(id: string) {
  patchTask(id, { background: true });
}

export function retryTask(id: string): boolean {
  const task = assistant.get().tasks[id];
  if (!task || task.status !== 'failed' || !isOnline()) return false;
  patchTask(id, {
    status: 'running',
    failure: undefined,
    plan: task.plan.map((s) => (s.status === 'failed' ? { ...s, status: 'waiting' as const } : s)),
  });
  advance(id);
  return true;
}

function resumeRunning() {
  Object.values(assistant.get().tasks).forEach((task) => {
    if (task.status === 'running') advance(task.id);
  });
}

function advance(id: string) {
  const task = assistant.get().tasks[id];
  if (!task || task.status !== 'running') return;
  const next = task.plan.find((s) => stepActive(s, task.jobId) && s.status !== 'done');
  if (!next) return finish(id);
  if (!isOnline()) return fail(id, next.key, 'offline');
  setStep(id, next.key, 'in_progress');
  timers.set(
    id,
    setTimeout(() => void completeStep(id, next.key), stepDurationMs(next.key)),
  );
}

async function completeStep(id: string, key: PlanStepKey) {
  timers.delete(id);
  const task = assistant.get().tasks[id];
  if (!task || task.status !== 'running') return;
  const ctx = genContext(task);
  const failure = checkStep(key, { cvCount: ctx.items.length, jobFound: !!ctx.job });
  if (failure) return fail(id, key, failure);

  if (key === 'draft_post') patchTask(id, { result: { ...task.result, ...summarizeTask('linkedin_post', ctx) } });
  if (key === 'request_publish') {
    const draft = assistant.get().tasks[id]?.result?.postDraft;
    if (!draft) return fail(id, key, 'cv_missing');
    try {
      // Registers a PENDING approval. Nothing is published here.
      const approval = await registerApproval(buildPostApproval(draft, [t('common.yourCv')]));
      if (assistant.get().tasks[id]?.status !== 'running') return;
      patchTask(id, { approvalId: approval.id });
    } catch {
      return fail(id, key, 'offline');
    }
  }
  setStep(id, key, 'done');
  advance(id);
}

function finish(id: string) {
  const task = assistant.get().tasks[id];
  if (!task) return;
  const result = task.kind === 'linkedin_post' ? task.result : { ...task.result, ...summarizeTask(task.kind, genContext(task)) };
  patchTask(id, { status: task.approvalId ? 'awaiting_approval' : 'done', result });
  haptics.success();
  if (task.background) {
    pushMessage({ role: 'assistant', text: tk(task.approvalId ? 'bgAwaiting' : 'bgDone', { title: taskTitle(task.kind) }), taskId: id });
  }
}

function fail(id: string, key: PlanStepKey, reason: TaskFailure) {
  const task = assistant.get().tasks[id];
  if (!task) return;
  patchTask(id, { status: 'failed', failure: reason, plan: task.plan.map((s) => (s.key === key ? { ...s, status: 'failed' as const } : s)) });
  haptics.error();
  if (task.background) pushMessage({ role: 'assistant', text: tk('bgFailed', { title: taskTitle(task.kind) }), taskId: id });
}

// --- Derived status -----------------------------------------------------------------

/** An awaiting-approval task follows its approval: sent -> done, cancelled/expired -> cancelled. */
export function resolveTask(task: AssistantTask, approvals: Approval[]): AssistantTask {
  if (task.status !== 'awaiting_approval' || !task.approvalId) return task;
  const a = approvals.find((x) => x.id === task.approvalId);
  if (!a) return task;
  if (a.status === 'sent') return { ...task, status: 'done' };
  if (a.status === 'cancelled' || a.status === 'expired') return { ...task, status: 'cancelled' };
  if (a.status === 'failed') return { ...task, status: 'failed' };
  if (a.status === 'pending' && new Date(a.expiresAt).getTime() <= Date.now()) return { ...task, status: 'cancelled' };
  return task;
}

/** Hook: a task with its status resolved against the approvals inbox. */
export function useTask(id: string | undefined): AssistantTask | undefined {
  const task = assistant.use((s) => (id ? s.tasks[id] : undefined));
  const approvals = data.use((s) => s.approvals);
  return useMemo(() => (task ? resolveTask(task, approvals) : undefined), [task, approvals]);
}

// --- Saved CV drafts (local only) -----------------------------------------------------

export function saveCvDraft(input: Omit<SavedCvDraft, 'id' | 'createdAt'>): SavedCvDraft {
  const draft: SavedCvDraft = { ...input, id: uid('cvd'), createdAt: new Date().toISOString() };
  assistant.set({ drafts: [draft, ...assistant.get().drafts].slice(0, MAX_DRAFTS) });
  return draft;
}
