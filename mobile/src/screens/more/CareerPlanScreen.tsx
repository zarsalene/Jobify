import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { AiBadge, SourceNote } from '@/components/domain/Honesty';
import { EmptyState } from '@/components/states';
import { Button, Icon, Row, Screen, Section, Text } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { data } from '@/state/data';
import { profile } from '@/state/profile';
import { PAGE_MARGIN } from '@/theme';

function Milestone({
  done,
  title,
  body,
  actionLabel,
  onAction,
}: {
  done?: boolean;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { t } = useT();
  const status = done === undefined ? undefined : done ? t('extras.careerDone') : t('extras.careerTodo');
  return (
    <View
      accessible={!onAction}
      accessibilityLabel={onAction ? undefined : [title, status, body].filter(Boolean).join('. ')}
      style={{ flexDirection: 'row', gap: 12, padding: PAGE_MARGIN, alignItems: 'flex-start' }}>
      <View style={{ width: 24, alignItems: 'center', paddingTop: 1 }}>
        <Icon name={done ? 'checkCircleFilled' : 'circle'} size={22} color={done ? 'greenText' : 'tertiaryLabel'} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="headline">{title}</Text>
        {status ? (
          <Text variant="footnote" weight="600" color={done ? 'greenText' : 'secondaryLabel'}>
            {status}
          </Text>
        ) : null}
        <Text variant="subheadline" color="secondaryLabel">
          {body}
        </Text>
        {actionLabel && onAction ? <Button title={actionLabel} variant="tinted" size="medium" onPress={onAction} style={{ marginTop: 6 }} /> : null}
      </View>
    </View>
  );
}

export default function CareerPlanScreen() {
  const { t } = useT();
  const setup = profile.use((s) => s.setup);
  const cv = profile.use((s) => s.cv);
  const jobs = data.use((s) => s.jobs);
  const savedIds = data.use((s) => s.savedIds);
  const applications = data.use((s) => s.applications);

  const gaps = useMemo(() => {
    if (!cv) return [];
    const have = new Set(cv.items.filter((i) => i.section === 'skills').map((i) => i.label.trim().toLowerCase()));
    const ids = new Set<string>([...savedIds, ...applications.flatMap((a) => (a.jobId ? [a.jobId] : []))]);
    const counts = new Map<string, { label: string; n: number }>();
    ids.forEach((id) => {
      jobs[id]?.skills.forEach((s) => {
        const key = s.trim().toLowerCase();
        if (have.has(key)) return;
        const cur = counts.get(key);
        counts.set(key, { label: s, n: (cur?.n ?? 0) + 1 });
      });
    });
    return [...counts.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 3)
      .map((c) => c.label);
  }, [cv, jobs, savedIds, applications]);

  const targetRole = setup?.targetRole?.trim();
  if (!targetRole) {
    return (
      <Screen>
        <EmptyState
          icon="flag"
          title={t('extras.careerEmptyTitle')}
          message={t('extras.careerEmptyBody')}
          actionLabel={t('extras.careerEmptyAction')}
          onAction={() => router.push('/search-preferences')}
        />
      </Screen>
    );
  }

  const cvAllConfirmed = !!cv && cv.items.length > 0 && cv.items.every((i) => i.status === 'confirmed');
  const m1Body = !cv ? t('extras.careerM1Missing') : cvAllConfirmed ? t('extras.careerM1Done') : t('extras.careerM1Todo');
  const m2Body = !cv
    ? t('extras.careerM2None')
    : gaps.length > 0
      ? t('extras.careerM2Body', { skills: gaps.join(', ') })
      : savedIds.length + applications.length === 0
        ? t('extras.careerM2None')
        : t('extras.careerM2Clear');
  const m2Done = !!cv && gaps.length === 0 && savedIds.length + applications.length > 0;

  const levelKey = setup?.seniority ? (`jobs.level_${setup.seniority}` as TKey) : undefined;

  return (
    <Screen>
      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 12 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('extras.careerIntro')}
        </Text>
      </View>

      <Section header={t('extras.careerGoalHeader')} separatorInset={57}>
        <Row icon="target" title={targetRole} subtitle={t('extras.careerGoalLabel')} />
        {setup?.location ? <Row icon="mapPin" title={setup.location} subtitle={t('extras.careerLocation')} /> : null}
        {levelKey ? <Row icon="trending" title={t(levelKey)} subtitle={t('extras.careerSeniority')} /> : null}
      </Section>

      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 20, gap: 8 }}>
        <AiBadge />
        <SourceNote sources={[t('extras.careerSources')]} />
        <Text variant="footnote" color="secondaryLabel">
          {t('extras.careerSuggestionNote')}
        </Text>
      </View>

      <Section header={t('extras.careerMilestonesHeader')}>
        <Milestone done={cvAllConfirmed} title={t('extras.careerM1')} body={m1Body} />
        <Milestone done={m2Done} title={t('extras.careerM2')} body={m2Body} />
        <Milestone title={t('extras.careerM3')} body={t('extras.careerM3Body', { count: applications.length })} />
        <Milestone
          title={t('extras.careerM4')}
          body={t('extras.careerM4Body')}
          actionLabel={t('extras.careerM4Action')}
          onAction={() => router.push('/interview-prep')}
        />
        <Milestone title={t('extras.careerM5')} body={t('extras.careerM5Body')} />
      </Section>
    </Screen>
  );
}
