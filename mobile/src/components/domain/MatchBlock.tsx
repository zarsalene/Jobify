import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { FactorStatus, MatchFactor, MatchResult } from '@/api/types';
import { AiBadge, SourceNote } from '@/components/domain/Honesty';
import { Card, Chip, Icon, MatchChip, Text, type IconName } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useT, type TKey } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { hairline, useTheme } from '@/theme';

/** Expandable row (iOS disclosure). Collapsed by default. */
export function Disclosure({
  title,
  children,
  leading,
  defaultOpen,
}: {
  title: string;
  children: ReactNode;
  leading?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const reduce = useReduceMotion();
  return (
    <View>
      <Pressable
        onPress={() => {
          haptics.select();
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {leading}
        <Text variant="subheadline" weight="600" style={{ flex: 1 }}>
          {title}
        </Text>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} color="secondaryLabel" weight="semibold" />
      </Pressable>
      {open ? (
        <Animated.View entering={reduce ? undefined : FadeIn.duration(180)} style={{ paddingBottom: 8 }}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

const FACTOR_META: Record<FactorStatus, { icon: IconName; color: string; label: TKey }> = {
  good: { icon: 'checkCircleFilled', color: 'greenText', label: 'jobs.factorGood' },
  ok: { icon: 'minusCircle', color: 'orangeText', label: 'jobs.factorOk' },
  poor: { icon: 'alertCircle', color: 'redText', label: 'jobs.factorPoor' },
  unknown: { icon: 'help', color: 'secondaryLabel', label: 'jobs.factorUnknown' },
};

function FactorRow({ f }: { f: MatchFactor }) {
  const { t } = useT();
  const m = FACTOR_META[f.status];
  return (
    <View accessible accessibilityLabel={`${f.label}, ${t(m.label)}. ${f.detail}`} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8 }}>
      <Icon name={m.icon} size={18} color={m.color} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text variant="subheadline" weight="600" style={{ flexShrink: 1 }}>
            {f.label}
          </Text>
          <Text variant="footnote" color={m.color}>
            {t(m.label)}
          </Text>
        </View>
        <Text variant="footnote" color="secondaryLabel">
          {f.detail}
        </Text>
      </View>
    </View>
  );
}

/**
 * The match block at the top of a job: score, level, short reason, strengths,
 * gaps (each with "how to close this gap"), and an expandable breakdown that
 * separates rule-based checks from AI judgement.
 */
export function MatchBlock({ match }: { match: MatchResult }) {
  const { t } = useT();
  const { colors } = useTheme();

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }} accessible accessibilityLabel={`${match.score} ${t('jobs.scoreOutOf')} 100`}>
          <Text variant="largeTitle" style={{ fontSize: 44, lineHeight: 50 }} maxFontSizeMultiplier={1.4}>
            {match.score}
          </Text>
          <Text variant="subheadline" color="secondaryLabel">
            {t('jobs.scoreOutOf')}
          </Text>
        </View>
        <View style={{ marginBottom: 6 }}>
          <MatchChip level={match.level} />
        </View>
      </View>

      <Text variant="body">{match.reason}</Text>
      <SourceNote sources={match.basedOn} />

      <View style={{ height: hairline, backgroundColor: colors.separator }} />

      <View style={{ gap: 8 }}>
        <Text variant="footnote" color="secondaryLabel" style={{ textTransform: 'uppercase' }} accessibilityRole="header">
          {t('jobs.strengths')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {match.strengths.length ? (
            match.strengths.map((s) => <Chip key={s} label={s} icon="check" tone="green" size="md" />)
          ) : (
            <Text variant="footnote" color="secondaryLabel">
              {t('common.none')}
            </Text>
          )}
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <Text variant="footnote" color="secondaryLabel" style={{ textTransform: 'uppercase' }} accessibilityRole="header">
          {t('jobs.gaps')}
        </Text>
        {match.gaps.length ? (
          match.gaps.map((g) => (
            <Disclosure key={g.label} title={g.label} leading={<Icon name="minusCircle" size={18} color="orangeText" />}>
              <View style={{ marginStart: 28, gap: 2 }}>
                <Text variant="footnote" weight="600" color="secondaryLabel">
                  {t('jobs.howToClose')}
                </Text>
                <Text variant="subheadline">{g.howToClose}</Text>
              </View>
            </Disclosure>
          ))
        ) : (
          <Text variant="subheadline" color="secondaryLabel">
            {t('jobs.noGaps')}
          </Text>
        )}
      </View>

      <View style={{ height: hairline, backgroundColor: colors.separator }} />

      <Disclosure title={t('jobs.howCalculated')} leading={<Icon name="chart" size={18} color="accent" />}>
        <View style={{ gap: 4 }}>
          <Text variant="footnote" weight="600" color="secondaryLabel">
            {t('jobs.deterministic')}
          </Text>
          <Text variant="footnote" color="secondaryLabel">
            {t('jobs.deterministicNote')}
          </Text>
          {match.factors.deterministic.map((f) => (
            <FactorRow key={f.key} f={f} />
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Text variant="footnote" weight="600" color="secondaryLabel">
              {t('jobs.aiFactors')}
            </Text>
            <AiBadge />
          </View>
          <Text variant="footnote" color="secondaryLabel">
            {t('jobs.aiNote')}
          </Text>
          {match.factors.ai.map((f) => (
            <FactorRow key={f.key} f={f} />
          ))}
        </View>
      </Disclosure>
    </Card>
  );
}
