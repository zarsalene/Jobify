import { router, Stack } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import type { PrepRun } from '@/api/types';
import { JobCard } from '@/components/domain/JobCard';
import { SourceNote } from '@/components/domain/Honesty';
import { Button, Card, Chip, HeaderButton, Icon, ProgressBar, Row, Screen, Section, Skeleton, Text, type IconName } from '@/components/ui';
import { useLoad } from '@/hooks/useLoad';
import { useT } from '@/i18n';
import { formatCountdown } from '@/lib/format';
import { cvParser } from '@/state/cvParser';
import { data, fetchRecommended, loadApplications, loadApprovals, pendingApprovals, toggleSave } from '@/state/data';
import { useUnreadCount } from '@/state/notifications';
import { profile, profileCompleteness } from '@/state/profile';
import { session } from '@/state/session';
import { PAGE_MARGIN } from '@/theme';

function greeting(name: string | undefined, t: ReturnType<typeof useT>['t']) {
  if (!name) return t('home.greetingPlain');
  const first = name.trim().split(/\s+/)[0];
  const h = new Date().getHours();
  if (h < 12) return t('home.greetingMorning', { name: first });
  if (h < 18) return t('home.greetingAfternoon', { name: first });
  return t('home.greetingEvening', { name: first });
}

export default function HomeScreen() {
  const { t } = useT();
  const user = session.use((s) => s.user);
  const approvals = data.use((s) => s.approvals);
  const runs = data.use((s) => s.runs);
  const jobs = data.use((s) => s.jobs);
  const savedIds = data.use((s) => s.savedIds);
  const cachedRecommended = data.use((s) => s.recommendedIds);
  const prof = profile.use((s) => s);
  const parser = cvParser.use((s) => s.status);
  const unread = useUnreadCount();

  const recommended = useLoad(fetchRecommended, [], cachedRecommended.length ? cachedRecommended.map((id) => ({ job: jobs[id], match: data.get().matchSummaries[id] })).filter((i) => i.job) : undefined);

  useEffect(() => {
    void loadApprovals().catch(() => {});
    void loadApplications().catch(() => {});
  }, []);

  const pending = pendingApprovals(approvals);
  const activeRuns = useMemo(
    () => Object.values(runs).filter((r) => !r.approvalId && !r.steps.every((s) => s.status === 'done')) as PrepRun[],
    [runs],
  );
  const inProgressRuns = Object.values(runs).filter((r) => !r.approvalId) as PrepRun[];
  const completeness = profileCompleteness(prof);
  const items = recommended.data ?? [];

  // ---- Today's focus: one calm, concrete next step -----------------------
  const focus = (() => {
    const a = pending[0];
    if (a) {
      const company = (a.jobId && jobs[a.jobId]?.company) || a.actionName;
      return {
        icon: 'checkCircle' as IconName,
        title: t('home.focusApproval', { company }),
        body: t('home.focusApprovalBody'),
        cta: t('home.focusApprovalCta'),
        onPress: () => router.push(`/approval/${a.id}`),
      };
    }
    const r = inProgressRuns[0];
    if (r) {
      const company = jobs[r.jobId]?.company ?? '';
      return {
        icon: 'pencil' as IconName,
        title: t('home.focusPreparing', { company }),
        body: t('home.focusPreparingBody'),
        cta: t('home.focusPreparingCta'),
        onPress: () => router.push(`/prepare/${r.jobId}`),
      };
    }
    if (completeness.percent < 100) {
      return {
        icon: 'personCircle' as IconName,
        title: t('home.focusSetup'),
        body: t('home.focusSetupBody'),
        cta: t('home.focusSetupCta'),
        onPress: () => router.navigate('/profile'),
      };
    }
    return {
      icon: 'target' as IconName,
      title: t('home.focusJobs'),
      body: t('home.focusJobsBody'),
      cta: t('home.focusJobsCta'),
      onPress: () => router.navigate('/jobs'),
    };
  })();

  return (
    <Screen
      tabs
      onRefresh={async () => {
        await Promise.allSettled([recommended.reload(), loadApprovals(), loadApplications()]);
      }}>
      <Stack.Screen
        options={{
          title: greeting(user?.full_name, t),
          headerLeft: () => <HeaderButton icon="bell" label={t('home.notifications')} badge={unread} onPress={() => router.push('/notifications')} />,
          headerRight: () => <HeaderButton icon="tray" label={t('home.approvalsInbox')} badge={pending.length} onPress={() => router.push('/approvals')} />,
        }}
      />

      {/* Today's focus */}
      <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 8 }}>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={focus.icon} size={18} color="accent" />
            <Text variant="footnote" color="accent" weight="600" style={{ textTransform: 'uppercase' }}>
              {t('home.focusTitle')}
            </Text>
          </View>
          <Text variant="title3" accessibilityRole="header">
            {focus.title}
          </Text>
          <Text variant="subheadline" color="secondaryLabel">
            {focus.body}
          </Text>
          <Button title={focus.cta} onPress={focus.onPress} size="medium" />
        </Card>
      </View>

      {/* Pending approvals */}
      <Section header={t('home.approvalsTitle')}>
        {pending.length ? (
          <>
            {pending.slice(0, 2).map((a) => (
              <Row
                key={a.id}
                title={a.actionName}
                subtitle={a.subject ?? a.to}
                onPress={() => router.push(`/approval/${a.id}`)}
                trailing={<Chip label={t('home.expiresIn', { time: formatCountdown(a.expiresAt) })} icon="clock" tone="orange" size="sm" />}
              />
            ))}
            <Row title={t('home.approvalsCta')} icon="tray" onPress={() => router.push('/approvals')} subtitle={t(pending.length === 1 ? 'home.approvalsOne' : 'home.approvalsMany', { count: pending.length })} />
          </>
        ) : (
          <Row title={t('home.approvalsEmpty')} icon="checkCircle" chevron={false} />
        )}
      </Section>

      {/* Recommended */}
      <View style={{ marginTop: 24, marginHorizontal: PAGE_MARGIN + 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="title3" accessibilityRole="header">
          {t('home.recommended')}
        </Text>
        <Button title={t('common.seeAll')} variant="plain" size="small" fullWidth={false} onPress={() => router.navigate('/jobs')} />
      </View>
      <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 8, gap: 12 }}>
        {recommended.loading && !items.length ? (
          <>
            <Card style={{ gap: 8 }}>
              <Skeleton width="70%" height={18} />
              <Skeleton width="40%" height={14} />
              <Skeleton width="90%" height={14} />
            </Card>
          </>
        ) : items.length ? (
          items.slice(0, 3).map(({ job, match }) => (
            <JobCard key={job.id} job={job} match={match} saved={savedIds.includes(job.id)} onPress={() => router.push(`/job/${job.id}`)} onToggleSave={() => void toggleSave(job)} />
          ))
        ) : (
          <Text variant="subheadline" color="secondaryLabel">
            {t('home.recommendedEmpty')}
          </Text>
        )}
        <SourceNote sources={[t('common.yourCv'), t('common.yourPreferences')]} />
      </View>

      {/* Active tasks */}
      <Section header={t('home.activeTasks')}>
        {parser === 'uploading' || parser === 'reading' ? (
          <Row title={t('home.taskCv')} icon="document" chevron={false} trailing={<Chip label={t('prepare.statusInProgress')} size="sm" />} />
        ) : null}
        {prof.cv && prof.cv.items.some((i) => i.status !== 'confirmed') ? (
          <Row title={t('home.taskCvReady')} subtitle={t('home.taskCvReadyBody')} icon="eyeCheck" onPress={() => router.push('/cv')} />
        ) : null}
        {activeRuns.map((r) => {
          const done = r.steps.filter((s) => s.status === 'done').length;
          return (
            <Row
              key={r.id}
              title={t('home.taskPreparing', { title: jobs[r.jobId]?.title ?? '' })}
              subtitle={t('home.taskSteps', { done, total: r.steps.length })}
              icon="wand"
              onPress={() => router.push(`/prepare/${r.jobId}`)}
            />
          );
        })}
        {!activeRuns.length && !(parser === 'uploading' || parser === 'reading') && !(prof.cv && prof.cv.items.some((i) => i.status !== 'confirmed')) ? (
          <Row title={t('home.activeTasksEmpty')} icon="checklist" chevron={false} />
        ) : null}
      </Section>

      {/* Profile completeness */}
      <Section header={t('home.completeness')}>
        <View style={{ padding: PAGE_MARGIN, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="headline">{t('home.completenessPercent', { percent: completeness.percent })}</Text>
          </View>
          <ProgressBar value={completeness.percent / 100} />
          <Text variant="footnote" color="secondaryLabel">
            {completeness.missing.length ? t('home.completenessMissing', { items: completeness.missing.join(', ') }) : t('home.completenessDone')}
          </Text>
        </View>
        {completeness.missing.length ? <Row title={t('home.focusSetupCta')} icon="personCircle" onPress={() => router.navigate('/profile')} /> : null}
      </Section>

      {/* Add job */}
      <Section>
        <Row title={t('home.addJob')} subtitle={t('home.addJobBody')} icon="plusCircle" onPress={() => router.push('/job-import')} />
      </Section>
    </Screen>
  );
}
