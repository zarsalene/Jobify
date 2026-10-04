import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import type { AssistantTask, TaskFailure } from '@/api/types-assistant';
import { planPermission, stepActive } from '@/api/mock/assistant';
import type { PermissionLevel } from '@/api/types';
import { PermissionBadge, UnverifiedNote } from '@/components/domain/Honesty';
import { StepRow } from '@/components/domain/StepRow';
import { OfflineHint } from '@/components/states';
import { Button, Card, Chip, Icon, ProgressBar, Text } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { formatCountdown } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { cancelTask, confirmPlan, retryTask, setBackground, setTaskJob, taskTitle, toggleStep, useTask } from '@/state/assistant';
import { data } from '@/state/data';
import { MIN_TOUCH, useTheme } from '@/theme';

import { AiFooter, JobPicker } from './Bits';
import { STATUS_META, STEP_LABEL, TASK_ICON, TASK_JOB, taskRoute, useSourceLabels } from './meta';

// ---------------------------------------------------------------------------
// Status chip: text + icon, never colour alone.
// ---------------------------------------------------------------------------

export function TaskStatusChip({ status }: { status: AssistantTask['status'] }) {
  const { t } = useT();
  const m = STATUS_META[status];
  return <Chip label={t(m.label)} icon={m.icon} tone={m.tone} size="sm" />;
}

// ---------------------------------------------------------------------------
// Permission levels guide (Read / Write / Public / Destructive)
// ---------------------------------------------------------------------------

export function PermissionGuide() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const levels: PermissionLevel[] = ['read', 'write', 'public', 'destructive'];
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          haptics.select();
          setOpen((o) => !o);
        }}
        style={{ minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="info" size={18} color="accent" />
        <Text variant="subheadline" color="accent" style={{ flex: 1 }}>
          {t('assistant.permGuide')}
        </Text>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} color="tertiaryLabel" weight="semibold" />
      </Pressable>
      {open ? (
        <View style={{ gap: 12, paddingBottom: 8 }}>
          {levels.map((l) => (
            <PermissionBadge key={l} level={l} explain />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Approval card: what permission this needs, and the only way forward.
// ---------------------------------------------------------------------------

export function ApprovalCard({ task, nested }: { task: AssistantTask; nested?: boolean }) {
  const { t } = useT();
  const { colors } = useTheme();
  const approval = data.use((s) => s.approvals.find((a) => a.id === task.approvalId));
  const level: PermissionLevel = approval?.permission ?? 'public';
  return (
    <View style={{ backgroundColor: nested ? colors.cardNested : colors.card, borderRadius: 12, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon name="hand" size={18} color="orangeText" />
        <Text variant="headline" style={{ flex: 1 }}>
          {t('assistant.approvalTitle')}
        </Text>
      </View>
      <Text variant="subheadline" color="secondaryLabel">
        {t('assistant.approvalBody', { action: approval?.actionName ?? t('assistant.postActionName') })}
      </Text>
      <PermissionBadge level={level} explain />
      <Text variant="footnote" color="secondaryLabel">
        {t('assistant.approvalNothing')}
      </Text>
      {approval ? (
        <Text variant="footnote" color="secondaryLabel">
          {t('approvals.expiresIn', { time: formatCountdown(approval.expiresAt) })}
        </Text>
      ) : null}
      {task.approvalId ? (
        <Button
          title={t('assistant.openApproval')}
          icon="chevronRight"
          onPress={() => router.push(`/approval/${task.approvalId}`)}
          size="medium"
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Plan: numbered steps, what each reads, the permission each needs.
// ---------------------------------------------------------------------------

function PlanView({ task, editing }: { task: AssistantTask; editing: boolean }) {
  const { t } = useT();
  const { colors } = useTheme();
  const labels = useSourceLabels();
  const visible = task.plan.filter((s) => (task.jobId || !['read_job', 'find_gaps'].includes(s.key)) && (s.enabled || (editing && s.optional)));
  let n = 0;
  return (
    <View style={{ gap: 14 }} accessibilityLabel={t('assistant.planHeading')}>
      {visible.map((s) => {
        const active = stepActive(s, task.jobId);
        if (active) n += 1;
        return (
          <View key={s.key} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', opacity: active ? 1 : 0.55 }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="footnote" weight="600" color="secondaryLabel">
                {active ? n : '–'}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text variant="body" accessibilityLabel={`${active ? n : ''} ${t(STEP_LABEL[s.key])}`}>
                {t(STEP_LABEL[s.key])}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="eye" size={14} color="secondaryLabel" />
                <Text variant="footnote" color="secondaryLabel" style={{ flex: 1 }}>
                  {t('assistant.reads', { sources: labels(s.reads).join(', ') })}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <PermissionBadge level={s.permission} />
                {s.optional ? <Text variant="caption1" color="secondaryLabel">{t('common.optional')}</Text> : null}
              </View>
            </View>
            {editing && s.optional ? (
              <Switch
                value={s.enabled}
                onValueChange={() => {
                  haptics.select();
                  toggleStep(task.id, s.key);
                }}
                trackColor={{ true: colors.green, false: colors.fillSecondary }}
                accessibilityLabel={t(STEP_LABEL[s.key])}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Task card
// ---------------------------------------------------------------------------

const FAIL_KEY: Record<TaskFailure, TKey> = {
  offline: 'assistant.failOffline',
  job_missing: 'assistant.failJob',
  cv_missing: 'assistant.failCv',
};

const OPEN_KEY: Record<AssistantTask['kind'], TKey> = {
  improve_cv: 'assistant.openCv',
  cover_letter: 'assistant.openLetter',
  linkedin_profile: 'assistant.openLinkedIn',
  linkedin_post: 'assistant.openPost',
};

/** A task in the conversation (`detail` = the full detail screen version). */
export function TaskCard({ id, detail }: { id: string; detail?: boolean }) {
  const { t } = useT();
  const { colors } = useTheme();
  const { online } = useNetwork();
  const task = useTask(id);
  const job = data.use((s) => (task?.jobId ? s.jobs[task.jobId] : undefined));
  const [editing, setEditing] = useState(false);
  if (!task) return null;

  const jobMode = TASK_JOB[task.kind];
  const needsJobPick = jobMode === 'required' && !task.jobId;
  const activeSteps = task.plan.filter((s) => stepActive(s, task.jobId));
  const doneCount = activeSteps.filter((s) => s.status === 'done').length;
  const subtitle = task.jobId ? (job ? `${job.title} · ${job.company}` : t('assistant.jobUnknown')) : jobMode !== 'none' ? t('assistant.jobGeneral') : undefined;
  const showPicker = task.status === 'planning' && jobMode !== 'none' && (editing || needsJobPick);

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={TASK_ICON[task.kind]} size={20} color="accent" weight="medium" />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="headline" accessibilityRole="header">
            {taskTitle(task.kind)}
          </Text>
          {subtitle ? (
            <Text variant="footnote" color="secondaryLabel">
              {subtitle}
            </Text>
          ) : null}
          <TaskStatusChip status={task.status} />
        </View>
      </View>

      {/* ---- Planning: the visible plan, before anything runs ---- */}
      {task.status === 'planning' ? (
        <>
          <Text variant="subheadline" color="secondaryLabel">
            {t('assistant.planLead')}
          </Text>
          {showPicker ? (
            <View style={{ gap: 6 }}>
              <Text variant="footnote" color="secondaryLabel" weight="500">
                {t('assistant.chooseJob')}
              </Text>
              <JobPicker nested value={task.jobId} onChange={(j) => setTaskJob(task.id, j)} allowGeneral={jobMode === 'optional'} />
            </View>
          ) : null}
          <PlanView task={task} editing={editing} />
          <View style={{ gap: 6 }}>
            <Text variant="footnote" color="secondaryLabel" weight="500">
              {t('assistant.highestPerm')}
            </Text>
            <PermissionBadge level={planPermission(task.plan, task.jobId)} explain />
          </View>
          <PermissionGuide />
          <View style={{ gap: 8 }}>
            <Button
              title={t('assistant.startPlan')}
              haptic="none"
              disabled={!online || needsJobPick}
              onPress={() => {
                haptics.tap();
                setEditing(false);
                confirmPlan(task.id);
              }}
            />
            {needsJobPick ? (
              <Text variant="footnote" color="secondaryLabel" align="center">
                {t('assistant.needJob')}
              </Text>
            ) : null}
            <OfflineHint />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                title={editing ? t('assistant.doneChanging') : t('assistant.changePlan')}
                variant="gray"
                size="medium"
                style={{ flex: 1 }}
                onPress={() => setEditing((e) => !e)}
              />
              <Button title={t('common.cancel')} variant="plain" size="medium" style={{ flex: 1 }} onPress={() => cancelTask(task.id)} />
            </View>
          </View>
        </>
      ) : null}

      {/* ---- Running: real step progress ---- */}
      {task.status === 'running' ? (
        <>
          <View style={{ gap: 6 }}>
            <ProgressBar value={activeSteps.length ? doneCount / activeSteps.length : 0} />
            <Text variant="footnote" color="secondaryLabel" accessibilityLiveRegion="polite">
              {t('assistant.progress', { done: doneCount, total: activeSteps.length })}
            </Text>
          </View>
          <View>
            {activeSteps.map((s, i) => (
              <StepRow key={s.key} label={t(STEP_LABEL[s.key])} status={s.status} last={i === activeSteps.length - 1} />
            ))}
          </View>
          {task.background ? (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Icon name="info" size={14} color="secondaryLabel" />
              <Text variant="footnote" color="secondaryLabel" style={{ flex: 1 }}>
                {t('assistant.bgNote')}
              </Text>
            </View>
          ) : (
            <Button title={t('prepare.background')} variant="gray" size="medium" onPress={() => setBackground(task.id)} />
          )}
          <Button title={t('assistant.stop')} variant="plain" size="medium" onPress={() => cancelTask(task.id)} />
        </>
      ) : null}

      {/* ---- Awaiting approval ---- */}
      {task.status === 'awaiting_approval' ? (
        <>
          {detail ? <StepList task={task} /> : null}
          <ApprovalCard task={task} nested />
        </>
      ) : null}

      {/* ---- Done ---- */}
      {task.status === 'done' ? (
        <>
          {detail ? <StepList task={task} /> : null}
          <ResultSummary task={task} />
          {task.kind !== 'linkedin_post' ? (
            <Button title={t(OPEN_KEY[task.kind])} variant="tinted" size="medium" onPress={() => router.push(taskRoute(task))} />
          ) : (
            <>
              <UnverifiedNote>{t('assistant.postMockNote')}</UnverifiedNote>
              {task.approvalId ? <Button title={t('assistant.openApprovalDone')} variant="gray" size="medium" onPress={() => router.push(taskRoute(task))} /> : null}
            </>
          )}
          <AiFooter sources={task.kind === 'improve_cv' || task.kind === 'cover_letter' ? (task.jobId ? ['cv', 'job'] : ['cv']) : task.kind === 'linkedin_profile' ? ['cv', 'prefs'] : ['cv']} />
        </>
      ) : null}

      {/* ---- Failed ---- */}
      {task.status === 'failed' ? (
        <>
          <StepList task={task} />
          <View style={{ gap: 6 }}>
            <Text variant="subheadline" color="redText" weight="600">
              {task.failure ? t(FAIL_KEY[task.failure]) : t('assistant.failGeneric')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Icon name="shield" size={16} color="greenText" />
              <Text variant="footnote" color="greenText" weight="600" style={{ flex: 1 }}>
                {task.approvalId ? t('assistant.safePublish') : t('assistant.safeNothing')}
              </Text>
            </View>
          </View>
          {task.failure && !task.approvalId ? (
            <>
              <Button title={t('states.retry')} variant="tinted" size="medium" disabled={!online || task.failure === 'cv_missing' || task.failure === 'job_missing'} onPress={() => retryTask(task.id)} />
              <OfflineHint />
              {task.failure === 'cv_missing' ? <Button title={t('assistant.reviewCv')} variant="plain" size="medium" onPress={() => router.push('/cv')} /> : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* ---- Cancelled ---- */}
      {task.status === 'cancelled' ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
          <Icon name="shield" size={16} color="greenText" />
          <Text variant="footnote" color="greenText" weight="600" style={{ flex: 1 }}>
            {task.approvalId ? t('assistant.cancelledApproval') : t('assistant.cancelledNote')}
          </Text>
        </View>
      ) : null}

      {!detail ? (
        <Pressable
          onPress={() => {
            haptics.select();
            router.push(`/assistant-task/${task.id}`);
          }}
          accessibilityRole="link"
          accessibilityLabel={t('assistant.viewDetails')}
          style={{ minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="subheadline" color="accent" style={{ flex: 1 }}>
            {t('assistant.viewDetails')}
          </Text>
          <Icon name="chevronRight" size={14} color="tertiaryLabel" weight="semibold" />
        </Pressable>
      ) : null}
    </Card>
  );
}

function StepList({ task }: { task: AssistantTask }) {
  const { t } = useT();
  const steps = task.plan.filter((s) => stepActive(s, task.jobId));
  return (
    <View>
      {steps.map((s, i) => (
        <StepRow key={s.key} label={t(STEP_LABEL[s.key])} status={s.status} last={i === steps.length - 1} />
      ))}
    </View>
  );
}

function ResultSummary({ task }: { task: AssistantTask }) {
  const { t } = useT();
  const r = task.result ?? {};
  let text = '';
  if (task.kind === 'improve_cv') text = t('assistant.resultCv', { count: r.count ?? 0, unverified: r.unverified ?? 0 });
  else if (task.kind === 'cover_letter') text = t('assistant.resultLetter');
  else if (task.kind === 'linkedin_profile') text = t('assistant.resultLinkedIn', { count: r.count ?? 0 });
  else text = t('assistant.resultPostDone');
  return (
    <Text variant="subheadline" color="secondaryLabel">
      {text}
    </Text>
  );
}
