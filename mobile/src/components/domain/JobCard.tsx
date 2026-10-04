import { Pressable, View } from 'react-native';

import type { Job, MatchLevel } from '@/api/types';
import { Chip, Icon, MatchChip, Text } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { formatRelative, formatSalary } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { MIN_TOUCH, radii, useTheme } from '@/theme';

export function useJobLabels() {
  const { t } = useT();
  return {
    // Undefined means the posting didn't say; shown as such rather than assumed.
    workMode: (m: Job['workMode']) => (m ? t(`jobs.workmode_${m}` as TKey) : t('jobs.notStated')),
    type: (m: Job['employmentType']) => (m ? t(`jobs.type_${m}` as TKey) : t('jobs.notStated')),
    level: (m: Job['seniority']) => (m ? t(`jobs.level_${m}` as TKey) : t('jobs.notStated')),
  };
}

export function SaveButton({ saved, onPress }: { saved: boolean; onPress: () => void }) {
  const { t } = useT();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      accessibilityLabel={saved ? t('jobs.unsave') : t('jobs.save')}
      style={({ pressed }) => ({
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
      })}>
      <Icon name={saved ? 'bookmarkFilled' : 'bookmark'} size={22} color="accent" />
    </Pressable>
  );
}

/** Feed card: title, company, location + mode, salary (only if stated) with its source, source label, match chip, save. */
export function JobCard({
  job,
  match,
  saved,
  onPress,
  onToggleSave,
}: {
  job: Job;
  match?: { score: number; level: MatchLevel };
  saved: boolean;
  onPress: () => void;
  onToggleSave: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const labels = useJobLabels();

  const a11y = [
    job.title,
    job.company,
    job.workMode ? `${job.location}, ${labels.workMode(job.workMode)}` : job.location,
    match ? t('jobs.matchA11y', { level: t(`jobs.level${match.level[0].toUpperCase()}${match.level.slice(1)}` as TKey), score: match.score }) : '',
    job.salary ? formatSalary(job.salary) : t('jobs.salaryNone'),
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.cardNested : colors.card,
        borderRadius: radii.lg + 2,
        padding: 16,
        gap: 8,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" numberOfLines={2}>
            {job.title}
          </Text>
          <Text variant="subheadline" color="secondaryLabel" numberOfLines={1}>
            {job.company}
          </Text>
        </View>
        <View style={{ marginTop: -10, marginEnd: -10 }}>
          <SaveButton saved={saved} onPress={onToggleSave} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="mapPin" size={14} color="secondaryLabel" />
        <Text variant="footnote" color="secondaryLabel" style={{ flex: 1 }} numberOfLines={1}>
          {job.location} · {labels.workMode(job.workMode)} · {labels.type(job.employmentType)}
        </Text>
      </View>

      {job.salary ? (
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="money" size={14} color="secondaryLabel" />
            <Text variant="footnote" weight="600">
              {formatSalary(job.salary)}
            </Text>
          </View>
          <Text variant="caption1" color="secondaryLabel">
            {t('jobs.salarySource', { source: job.salary.source })}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 2 }}>
        {match ? <MatchChip level={match.level} score={match.score} size="sm" /> : null}
        <Chip label={job.source.label} icon="link" size="sm" />
        <Text variant="caption1" color="secondaryLabel">
          {formatRelative(job.postedAt)}
        </Text>
      </View>
    </Pressable>
  );
}
