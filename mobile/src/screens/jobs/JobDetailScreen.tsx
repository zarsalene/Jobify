import * as WebBrowser from 'expo-web-browser';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import type { DescriptionBlock, Job } from '@/api/types';
import { useJobLabels } from '@/components/domain/JobCard';
import { MatchBlock } from '@/components/domain/MatchBlock';
import { SaveButton } from '@/components/domain/JobCard';
import { EmptyState, ErrorState } from '@/components/states';
import { OfflineHint } from '@/components/states/OfflineBanner';
import { Button, Card, Chip, Icon, Row, Screen, Section, Skeleton, Text } from '@/components/ui';
import { useLoad } from '@/hooks/useLoad';
import { useT } from '@/i18n';
import { formatRelative, formatSalary } from '@/lib/format';
import { useNetwork } from '@/lib/network';
import { data, fetchJob, fetchMatch, toggleSave } from '@/state/data';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';

function Description({ blocks }: { blocks: DescriptionBlock[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {blocks.map((b, i) => {
        if (b.type === 'heading') {
          return (
            <Text key={i} variant="headline" accessibilityRole="header" style={{ marginTop: 6 }}>
              {b.text}
            </Text>
          );
        }
        if (b.type === 'bullet') {
          return (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                gap: 10,
                padding: b.requirement ? 10 : 0,
                borderRadius: radii.md,
                backgroundColor: b.requirement ? colors.accentTint : 'transparent',
                borderStartWidth: b.requirement ? 3 : 0,
                borderStartColor: colors.accent,
              }}>
              {b.requirement ? (
                <Icon name="checklist" size={16} color="accent" />
              ) : (
                <Text variant="body" color="secondaryLabel">
                  {'•'}
                </Text>
              )}
              <Text variant="body" style={{ flex: 1 }}>
                {b.text}
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} variant="body">
            {b.text}
          </Text>
        );
      })}
    </View>
  );
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const { online } = useNetwork();
  const labels = useJobLabels();
  const saved = data.use((s) => s.savedIds.includes(id));
  const hasRun = data.use((s) => !!s.runByJob[id]);
  const cachedJob = data.use((s) => s.jobs[id]);
  const cachedMatch = data.use((s) => s.matches[id]);

  const job = useLoad<Job>(() => fetchJob(id), [id, online], cachedJob);
  const match = useLoad(() => fetchMatch(id), [id, online], cachedMatch);

  const j = job.data;
  if (!j) {
    return (
      <Screen>
        {job.loading ? (
          <View style={{ padding: PAGE_MARGIN, gap: 12 }}>
            <Skeleton width="80%" height={26} />
            <Skeleton width="50%" height={16} />
            <Skeleton height={160} radius={16} />
          </View>
        ) : (
          <ErrorState title={t('jobs.jobNotFound')} onRetry={job.reload} safeNote={t('states.errorSafe')} />
        )}
      </Screen>
    );
  }

  const m = match.data;

  return (
    <Screen
      footer={
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              title={saved ? t('common.saved') : t('jobs.save')}
              icon={saved ? 'bookmarkFilled' : 'bookmark'}
              variant="gray"
              fullWidth={false}
              onPress={() => void toggleSave(j)}
              style={{ flex: 1 }}
            />
            <Button
              title={hasRun ? t('jobs.prepareResume') : t('jobs.prepare')}
              icon="wand"
              fullWidth={false}
              disabled={!online}
              onPress={() => router.push(`/prepare/${j.id}`)}
              style={{ flex: 2 }}
            />
          </View>
          {!online ? <OfflineHint /> : null}
        </View>
      }>
      <Stack.Screen options={{ headerRight: () => <SaveButton saved={saved} onPress={() => void toggleSave(j)} /> }} />

      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: 8, gap: 6 }}>
        <Text variant="title1" accessibilityRole="header">
          {j.title}
        </Text>
        <Text variant="title3" color="secondaryLabel" weight="400">
          {j.company}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Icon name="mapPin" size={15} color="secondaryLabel" />
          <Text variant="subheadline" color="secondaryLabel" style={{ flex: 1 }}>
            {j.location} · {labels.workMode(j.workMode)} · {labels.type(j.employmentType)} · {labels.level(j.seniority)}
          </Text>
        </View>
        {j.salary ? (
          <View style={{ gap: 2, marginTop: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="money" size={15} color="secondaryLabel" />
              <Text variant="subheadline" weight="600">
                {formatSalary(j.salary)}
              </Text>
            </View>
            <Text variant="footnote" color="secondaryLabel">
              {t('jobs.salarySource', { source: j.salary.source })}
            </Text>
          </View>
        ) : (
          <Text variant="footnote" color="secondaryLabel">
            {t('jobs.salaryNone')}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <Chip label={t('jobs.source', { label: j.source.label })} icon="link" size="sm" />
          {j.postedAt ? (
            <Text variant="footnote" color="secondaryLabel">
              {t('jobs.postedAgo', { when: formatRelative(j.postedAt) })}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 20 }}>
        {m ? (
          <MatchBlock match={m} />
        ) : match.loading ? (
          <Card style={{ gap: 10 }} >
            <Text variant="footnote" color="secondaryLabel">
              {t('jobs.matchLoading')}
            </Text>
            <Skeleton width="40%" height={40} />
            <Skeleton height={14} />
            <Skeleton width="75%" height={14} />
          </Card>
        ) : (
          <Card>
            <EmptyState
              compact
              icon={online ? 'warning' : 'offline'}
              title={t('jobs.matchUnavailable')}
              message={online ? undefined : t('jobs.matchOfflineNote')}
              actionLabel={online ? t('common.retry') : undefined}
              onAction={match.reload}
            />
          </Card>
        )}
      </View>

      <Section header={t('jobs.about')}>
        <View style={{ padding: PAGE_MARGIN, gap: 10 }}>
          <Description blocks={j.description} />
          <Text variant="footnote" color="secondaryLabel">
            {t('jobs.requirementLegend')}
          </Text>
        </View>
      </Section>

      {j.skills.length ? (
        <Section header={t('jobs.skills')}>
          <View style={{ padding: PAGE_MARGIN, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {j.skills.map((s) => (
              <Chip key={s} label={s} />
            ))}
          </View>
        </Section>
      ) : null}

      <Section>
        <Row
          title={t('jobs.openOriginal')}
          icon="openExternal"
          onPress={() => void WebBrowser.openBrowserAsync(j.source.url)}
          chevron={false}
          disabled={!online}
          subtitle={!online ? t('common.offlineExplain') : j.source.url}
        />
      </Section>
    </Screen>
  );
}
