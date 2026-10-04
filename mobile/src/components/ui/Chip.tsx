import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useT, type TKey } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { radii, useTheme } from '@/theme';
import type { ApplicationStatus, MatchLevel } from '@/api/types';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type Tone = 'neutral' | 'accent' | 'green' | 'orange' | 'red';

export function useToneColors() {
  const { colors } = useTheme();
  return (tone: Tone): { bg: string; fg: string } => {
    switch (tone) {
      case 'accent':
        return { bg: colors.accentTint, fg: colors.accent };
      case 'green':
        return { bg: colors.greenTint, fg: colors.greenText };
      case 'orange':
        return { bg: colors.orangeTint, fg: colors.orangeText };
      case 'red':
        return { bg: colors.redTint, fg: colors.redText };
      default:
        return { bg: colors.fill, fg: colors.secondaryLabel };
    }
  };
}

export interface ChipProps {
  label: string;
  icon?: IconName;
  tone?: Tone;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
}

/** Small capsule. When `onPress` is set it behaves as a toggle (filters) with a 44pt hit area. */
export function Chip({ label, icon, tone = 'neutral', size = 'md', style, onPress, selected, accessibilityLabel }: ChipProps) {
  const { colors } = useTheme();
  const toneColors = useToneColors();
  const base = toneColors(selected ? 'accent' : tone);
  const bg = selected ? colors.accent : base.bg;
  const fg = selected ? colors.onAccent : base.fg;
  const body = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 4,
          paddingHorizontal: size === 'sm' ? 8 : 12,
          paddingVertical: size === 'sm' ? 3 : 6,
          borderRadius: radii.pill,
          backgroundColor: bg,
        },
        style,
      ]}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 12 : 14} color={fg} weight="semibold" /> : null}
      <Text variant={size === 'sm' ? 'caption1' : 'footnote'} color={fg} weight="600" style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel ?? label} style={{ alignSelf: 'flex-start' }}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
      {body}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Match level chip: colour is NEVER the only signal - always text + icon.
// ---------------------------------------------------------------------------

export const MATCH_META: Record<MatchLevel, { labelKey: TKey; tone: Tone; icon: IconName }> = {
  strong: { labelKey: 'jobs.levelStrong', tone: 'green', icon: 'checkCircleFilled' },
  good: { labelKey: 'jobs.levelGood', tone: 'green', icon: 'checkCircle' },
  partial: { labelKey: 'jobs.levelPartial', tone: 'orange', icon: 'minusCircle' },
  weak: { labelKey: 'jobs.levelWeak', tone: 'red', icon: 'alertCircle' },
};

export function MatchChip({ level, score, size = 'md' }: { level: MatchLevel; score?: number; size?: 'sm' | 'md' }) {
  const { t } = useT();
  const m = MATCH_META[level];
  const name = t(m.labelKey);
  const label = score !== undefined ? `${score}  ${name}` : name;
  return (
    <Chip
      label={label}
      icon={m.icon}
      tone={m.tone}
      size={size}
      accessibilityLabel={score !== undefined ? t('jobs.matchA11y', { level: name, score }) : name}
    />
  );
}

// ---------------------------------------------------------------------------
// Pipeline status chip (applications) - same rule: text + icon.
// ---------------------------------------------------------------------------

export const STATUS_META: Record<ApplicationStatus, { labelKey: TKey; tone: Tone; icon: IconName }> = {
  saved: { labelKey: 'tracker.statusSaved', tone: 'neutral', icon: 'bookmark' },
  preparing: { labelKey: 'tracker.statusPreparing', tone: 'accent', icon: 'pencil' },
  applied: { labelKey: 'tracker.statusApplied', tone: 'accent', icon: 'send' },
  interview: { labelKey: 'tracker.statusInterview', tone: 'orange', icon: 'calendar' },
  offer: { labelKey: 'tracker.statusOffer', tone: 'green', icon: 'checkCircleFilled' },
  rejected: { labelKey: 'tracker.statusRejected', tone: 'red', icon: 'closeCircle' },
};

export function StatusChip({ status, size = 'md' }: { status: ApplicationStatus; size?: 'sm' | 'md' }) {
  const { t } = useT();
  const m = STATUS_META[status];
  return <Chip label={t(m.labelKey)} icon={m.icon} tone={m.tone} size={size} />;
}
