import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { APPLICATION_STATUSES, type Application, type ApplicationStatus } from '@/api/types';
import { EmptyState } from '@/components/states';
import { Chip, MatchChip, Row, Screen, SegmentedControl, Section, StatusChip, STATUS_META, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { formatRelative } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { data, loadApplications } from '@/state/data';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';

function AppCard({ a }: { a: Application }) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        router.push(`/application/${a.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${a.jobTitle}, ${a.company}`}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.cardNested : colors.card, borderRadius: radii.lg, padding: 14, gap: 6 })}>
      <Text variant="headline" numberOfLines={2}>
        {a.jobTitle}
      </Text>
      <Text variant="subheadline" color="secondaryLabel" numberOfLines={1}>
        {a.company}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {a.matchLevel && a.matchScore !== undefined ? <MatchChip level={a.matchLevel} score={a.matchScore} size="sm" /> : null}
        {a.reminder ? <Chip label={t('tracker.reminder')} icon="calendar" size="sm" /> : null}
      </View>
      <Text variant="caption1" color="secondaryLabel">
        {t('tracker.updated', { when: formatRelative(a.updatedAt) })}
      </Text>
    </Pressable>
  );
}

function Board({ apps }: { apps: Application[] }) {
  const { t } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList<ApplicationStatus>>(null);
  const pageWidth = Math.min(width - PAGE_MARGIN * 2 - 24, 420);
  const gap = 12;

  return (
    <View style={{ marginTop: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_MARGIN, gap: 8 }}>
        {APPLICATION_STATUSES.map((s, i) => (
          <Chip
            key={s}
            label={`${t(STATUS_META[s].labelKey)} ${apps.filter((a) => a.status === s).length}`}
            selected={i === index}
            onPress={() => {
              setIndex(i);
              ref.current?.scrollToIndex({ index: i, animated: true });
            }}
          />
        ))}
      </ScrollView>

      <FlatList
        ref={ref}
        horizontal
        data={APPLICATION_STATUSES}
        keyExtractor={(s) => s}
        showsHorizontalScrollIndicator={false}
        snapToInterval={pageWidth + gap}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: PAGE_MARGIN, gap, paddingTop: 12 }}
        getItemLayout={(_, i) => ({ length: pageWidth + gap, offset: (pageWidth + gap) * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (pageWidth + gap)))}
        renderItem={({ item: status }) => {
          const col = apps.filter((a) => a.status === status);
          return (
            <View
              accessibilityLabel={`${t(STATUS_META[status].labelKey)}, ${col.length}`}
              style={{ width: pageWidth, backgroundColor: colors.fill, borderRadius: radii.xl, padding: 10, gap: 10, minHeight: 220 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                <StatusChip status={status} />
                <Text variant="subheadline" color="secondaryLabel">
                  {col.length}
                </Text>
              </View>
              {col.length ? (
                col.map((a) => <AppCard key={a.id} a={a} />)
              ) : (
                <Text variant="footnote" color="secondaryLabel" align="center" style={{ paddingVertical: 24 }}>
                  {t('tracker.emptyColumn')}
                </Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

function ListView({ apps }: { apps: Application[] }) {
  const { t } = useT();
  return (
    <>
      {APPLICATION_STATUSES.map((s) => {
        const col = apps.filter((a) => a.status === s);
        if (!col.length) return null;
        return (
          <Section key={s} header={`${t(STATUS_META[s].labelKey)} (${col.length})`}>
            {col.map((a) => (
              <Row
                key={a.id}
                title={a.jobTitle}
                subtitle={`${a.company} · ${t('tracker.updated', { when: formatRelative(a.updatedAt) })}`}
                onPress={() => router.push(`/application/${a.id}`)}
              />
            ))}
          </Section>
        );
      })}
    </>
  );
}

export default function TrackerScreen() {
  const { t } = useT();
  const apps = data.use((s) => s.applications);
  const [view, setView] = useState<'board' | 'list'>('board');

  useEffect(() => {
    void loadApplications().catch(() => {});
  }, []);

  return (
    <Screen tabs onRefresh={async () => void (await loadApplications().catch(() => {}))}>
      <View style={{ paddingHorizontal: PAGE_MARGIN, paddingTop: 8 }}>
        <SegmentedControl
          accessibilityLabel={t('tracker.title')}
          value={view}
          onChange={setView}
          options={[
            { value: 'board', label: t('tracker.board') },
            { value: 'list', label: t('tracker.list') },
          ]}
        />
      </View>
      {apps.length === 0 ? (
        <EmptyState
          icon="applications"
          title={t('tracker.emptyTitle')}
          message={t('tracker.emptyBody')}
          actionLabel={t('tracker.browseJobs')}
          onAction={() => router.navigate('/jobs')}
        />
      ) : view === 'board' ? (
        <Board apps={apps} />
      ) : (
        <ListView apps={apps} />
      )}
    </Screen>
  );
}
