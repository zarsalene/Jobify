import type { AssistantTask, PlanStepKey, SourceKey, TaskKind, TaskStatus } from '@/api/types-assistant';
import type { IconName, Tone } from '@/components/ui';
import { useT, type TKey } from '@/i18n';

/** i18n key for each plan step. */
export const STEP_LABEL: Record<PlanStepKey, TKey> = {
  read_cv: 'assistant.step_read_cv',
  read_job: 'assistant.step_read_job',
  read_prefs: 'assistant.step_read_prefs',
  find_gaps: 'assistant.step_find_gaps',
  draft_cv: 'assistant.step_draft_cv',
  draft_letter: 'assistant.step_draft_letter',
  draft_profile: 'assistant.step_draft_profile',
  draft_post: 'assistant.step_draft_post',
  request_publish: 'assistant.step_request_publish',
};

export const TASK_ICON: Record<TaskKind, IconName> = {
  improve_cv: 'document',
  cover_letter: 'envelope',
  linkedin_profile: 'briefcaseUser',
  linkedin_post: 'megaphone',
};

/** How each task uses a job: required, optional (general is allowed) or not at all. */
export const TASK_JOB: Record<TaskKind, 'required' | 'optional' | 'none'> = {
  improve_cv: 'optional',
  cover_letter: 'required',
  linkedin_profile: 'none',
  linkedin_post: 'none',
};

export const STATUS_META: Record<TaskStatus, { label: TKey; icon: IconName; tone: Tone }> = {
  planning: { label: 'assistant.statusPlanning', icon: 'list', tone: 'neutral' },
  running: { label: 'assistant.statusRunning', icon: 'hourglass', tone: 'accent' },
  awaiting_approval: { label: 'assistant.statusAwaiting', icon: 'hand', tone: 'orange' },
  done: { label: 'assistant.statusDone', icon: 'checkCircleFilled', tone: 'green' },
  failed: { label: 'assistant.statusFailed', icon: 'warning', tone: 'red' },
  cancelled: { label: 'assistant.statusCancelled', icon: 'minusCircle', tone: 'neutral' },
};

/** Where the finished work lives. */
export function taskRoute(task: AssistantTask): string {
  // auto=1: open the tool with the finished result instead of asking again.
  const job = `?auto=1${task.jobId ? `&jobId=${encodeURIComponent(task.jobId)}` : ''}`;
  switch (task.kind) {
    case 'improve_cv':
      return `/cv-optimizer${job}`;
    case 'cover_letter':
      return `/cover-letter${job}`;
    case 'linkedin_profile':
      return '/linkedin';
    case 'linkedin_post':
      return task.approvalId ? `/approval/${task.approvalId}` : '/linkedin-post';
  }
}

/** Human labels for source keys ("your CV", "job post", ...). */
export function useSourceLabels() {
  const { t } = useT();
  return (keys: SourceKey[]) =>
    keys.map((k) => (k === 'cv' ? t('common.yourCv') : k === 'job' ? t('common.jobPost') : t('assistant.srcPrefs')));
}
