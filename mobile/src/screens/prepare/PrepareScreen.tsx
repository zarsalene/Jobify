import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import type { DraftKind, PrepRun, PrepStepKey } from '@/api/types';
import { AiBadge, SourceNote } from '@/components/domain/Honesty';
import { StepRow } from '@/components/domain/StepRow';
import { ErrorState } from '@/components/states';
import { OfflineHint } from '@/components/states/OfflineBanner';
import { Button, Card, Chip, ProgressBar, Row, Screen, Section, Skeleton, Text } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { useNetwork } from '@/lib/network';
import { data, fetchJob, refreshRun, retryPrepStep, startPreparation } from '@/state/data';
import { profile } from '@/state/profile';
import { PAGE_MARGIN } from '@/theme';

const STEP_LABEL: Record<PrepStepKey, TKey> = {
  job_analyzed: 'prepare.stepJob',
  cv_analyzed: 'prepare.stepCv',
  cover_letter: 'prepare.stepCover',
  recruiter_email: 'prepare.stepEmail',
};

const DOCS: { kind: DraftKind; title: TKey; step: PrepStepKey }[] = [
  { kind: 'cv', title: 'prepare.docCv', step: 'cv_analyzed' },
  { kind: 'cover_letter', title: 'prepare.docCover', step: 'cover_letter' },
  { kind: 'email', title: 'prepare.docEmail', step: 'recruiter_email' },
];

export default function PrepareScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { t } = useT();
  const { online } = useNetwork();
  const cv = profile.use((s) => s.cv);
  const [runId, setRunId] = useState<string | undefined>(data.get().runByJob[jobId]);
  const [startError, setStartError] = useState(false);
  const run = data.use((s) => (runId ? s.runs[runId] : undefined)) as PrepRun | undefined;
  const job = data.use((s) => s.jobs[jobId]);
  const started = useRef(false);

  // Start (or resume) the preparation once.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const j = data.get().jobs[jobId] ?? (await fetchJob(jobId));
        const r = await startPreparation(j);
        setRunId(r.id);
      } catch {
        // Offline with an existing run is fine - we show the cached one.
        if (!data.get().runByJob[jobId]) setStartError(true);
      }
    })();
  }, [jobId]);

  const allDone = !!run && run.steps.every((s) => s.status === 'done');
  const failed = !!run && run.steps.some((s) => s.status === 'failed');

  // Poll while work is in progress.
  useEffect(() => {
    if (!runId || allDone || failed || !online) return;
    const id = setInterval(() => void refreshRun(runId).catch(() => {}), 1000);
    return () => clearInterval(id);
  }, [runId, allDone, failed, online]);

  const doneCount = run ? run.steps.filter((s) => s.status === 'done').length : 0;
  const confirmedCount = cv ? cv.items.filter((i) => i.status === 'confirmed').length : 0;
  const stepStatus = (k: PrepStepKey) => run?.steps.find((s) => s.key === k)?.status ?? 'waiting';

  if (startError && !run) {
    return (
      <Screen>
        <ErrorState title={t('prepare.startError')} onRetry={() => { started.current = false; setStartError(false); router.replace(`/prepare/${jobId}`); }} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: 6 }}>
          <Button
            title={t('prepare.reviewSend')}
            disabled={!allDone || !runId}
            onPress={() => router.push(`/review/${runId}`)}
          />
          {!allDone ? (
            <Text variant="footnote" color="secondaryLabel" align="center">
              {t('prepare.reviewDisabled')}
            </Text>
          ) : null}
        </View>
      }>
      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: 4, gap: 4 }}>
        {job ? (
          <>
            <Text variant="headline">{job.title}</Text>
            <Text variant="subheadline" color="secondaryLabel">
              {job.company}
            </Text>
          </>
        ) : (
          <Skeleton width="60%" height={18} />
        )}
        <Text variant="callout" color="secondaryLabel" style={{ marginTop: 8 }}>
          {t('prepare.intro')}
        </Text>
      </View>

      <Section header={t('prepare.progress')}>
        <View style={{ padding: PAGE_MARGIN, gap: 12 }}>
          {run ? (
            <>
              <ProgressBar value={doneCount / run.steps.length} />
              <View>
                {run.steps.map((s, i) => (
                  <StepRow key={s.key} label={t(STEP_LABEL[s.key])} status={s.status} last={i === run.steps.length - 1} />
                ))}
              </View>
            </>
          ) : (
            <View style={{ gap: 10 }}>
              <Skeleton height={14} />
              <Skeleton width="80%" height={14} />
              <Skeleton width="60%" height={14} />
            </View>
          )}
          {failed && runId ? (
            <View style={{ gap: 8 }}>
              <Text variant="footnote" color="redText">
                {t('prepare.stepFailedBody')}
              </Text>
              <Button title={t('prepare.retryStep')} variant="tinted" size="medium" disabled={!online} onPress={() => void retryPrepStep(runId)} />
            </View>
          ) : null}
          {!allDone && !failed ? (
            <View style={{ gap: 4 }}>
              <Button title={t('prepare.background')} variant="gray" size="medium" onPress={() => router.dismissAll()} />
              <Text variant="footnote" color="secondaryLabel" align="center">
                {t('prepare.backgroundNote')}
              </Text>
            </View>
          ) : null}
          {!online ? <OfflineHint /> : null}
        </View>
      </Section>

      <Section header={t('prepare.checklist')}>
        {DOCS.map((d) => {
          const ready = stepStatus(d.step) === 'done' && !!runId;
          return (
            <Row
              key={d.kind}
              title={t(d.title)}
              subtitle={ready ? t('prepare.docReady') : t('prepare.docWaiting')}
              onPress={ready ? () => router.push(`/draft/${runId}/${d.kind}`) : undefined}
              disabled={!ready}
              chevron={ready}
              trailing={ready ? <AiBadge /> : undefined}
            />
          );
        })}
        {run && run.cvChanges.length ? (
          <Row
            title={t('prepare.reviewChanges')}
            subtitle={t('prepare.cvChangesCount', { count: run.cvChanges.length })}
            icon="swap"
            onPress={() => router.push(`/cv-diff/${runId}`)}
          />
        ) : null}
      </Section>

      <Section header={t('prepare.sourcesTitle')} footer={t('prepare.sourcesBody')}>
        <View style={{ padding: PAGE_MARGIN, gap: 8 }}>
          <SourceNote sources={[t('common.yourCv'), t('common.jobPost')]} />
          <Chip label={t('prepare.sourceCv', { count: confirmedCount })} icon="document" size="sm" />
          {job ? <Chip label={t('prepare.sourceJob', { title: job.title })} icon="jobs" size="sm" /> : null}
        </View>
      </Section>
    </Screen>
  );
}
