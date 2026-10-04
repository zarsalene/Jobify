import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card, ProgressBar, Skeleton } from '@/components/ui/Feedback';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useT } from '@/i18n';
import { useNetwork } from '@/lib/network';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';

// ---------------------------------------------------------------------------
// Shared layout: icon in a soft circle, title, message, optional actions.
// ---------------------------------------------------------------------------

function StateLayout({
  icon,
  tone = 'accent',
  title,
  message,
  extra,
  actions,
  compact,
}: {
  icon: IconName;
  tone?: 'accent' | 'green' | 'orange' | 'red' | 'neutral';
  title: string;
  message?: string;
  extra?: React.ReactNode;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const palette = {
    accent: [colors.accentTint, colors.accent],
    green: [colors.greenTint, colors.greenText],
    orange: [colors.orangeTint, colors.orangeText],
    red: [colors.redTint, colors.redText],
    neutral: [colors.fill, colors.secondaryLabel],
  }[tone];
  return (
    <View
      accessible={false}
      style={{ alignItems: 'center', paddingHorizontal: PAGE_MARGIN + 8, paddingVertical: compact ? 24 : 48, gap: 12 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: palette[0],
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size={28} color={palette[1]} weight="medium" />
      </View>
      <Text variant="title3" align="center" accessibilityRole="header">
        {title}
      </Text>
      {message ? (
        <Text variant="callout" color="secondaryLabel" align="center">
          {message}
        </Text>
      ) : null}
      {extra}
      {actions ? <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 8 }}>{actions}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export function EmptyState({
  icon = 'tray',
  title,
  message,
  actionLabel,
  onAction,
  compact,
}: {
  icon?: IconName;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const { t } = useT();
  return (
    <StateLayout
      icon={icon}
      tone="neutral"
      title={title ?? t('states.emptyTitle')}
      message={message}
      compact={compact}
      actions={actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant="tinted" size="medium" /> : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// ErrorState - always says what is safe.
// ---------------------------------------------------------------------------

export function ErrorState({
  title,
  message,
  safeNote,
  onRetry,
  compact,
}: {
  title?: string;
  message?: string;
  /** What is safe, e.g. "Nothing was sent." Default: "Nothing was sent or changed." */
  safeNote?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const { t } = useT();
  const { online } = useNetwork();
  return (
    <StateLayout
      icon={online ? 'warning' : 'offline'}
      tone={online ? 'orange' : 'neutral'}
      title={title ?? (online ? t('states.errorTitle') : t('states.errorOfflineTitle'))}
      message={message ?? (online ? undefined : t('states.errorOfflineBody'))}
      compact={compact}
      extra={
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Icon name="shield" size={16} color="greenText" />
          <Text variant="footnote" color="greenText" weight="600">
            {safeNote ?? t('states.errorSafe')}
          </Text>
        </View>
      }
      actions={onRetry ? <Button title={t('states.retry')} onPress={onRetry} variant="tinted" size="medium" /> : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// UsageLimit
// ---------------------------------------------------------------------------

export function UsageLimit({
  what,
  used,
  limit,
  resetsOn,
  onUpgrade,
}: {
  what: string;
  used: number;
  limit: number;
  resetsOn: string;
  onUpgrade?: () => void;
}) {
  const { t } = useT();
  return (
    <StateLayout
      icon="hourglass"
      tone="orange"
      title={t('states.usageTitle')}
      message={t('states.usageBody', { what, date: resetsOn })}
      extra={
        <View style={{ alignSelf: 'stretch', gap: 6 }}>
          <ProgressBar value={limit ? used / limit : 1} tint="#FF9500" />
          <Text variant="footnote" color="secondaryLabel" align="center">
            {t('states.usageUsed', { used, limit })}
          </Text>
        </View>
      }
      actions={onUpgrade ? <Button title={t('states.usageCta')} variant="tinted" size="medium" onPress={onUpgrade} /> : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// ParsingProblem
// ---------------------------------------------------------------------------

export function ParsingProblem({
  message,
  onRetry,
  onManual,
}: {
  message?: string;
  onRetry?: () => void;
  onManual?: () => void;
}) {
  const { t } = useT();
  return (
    <StateLayout
      icon="eyeCheck"
      tone="orange"
      title={t('states.parsingTitle')}
      message={message ?? t('states.parsingBody')}
      actions={
        <>
          {onRetry ? <Button title={t('states.retry')} onPress={onRetry} variant="tinted" size="medium" /> : null}
          {onManual ? <Button title={t('states.parsingManual')} onPress={onManual} variant="plain" size="medium" /> : null}
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

export function Success({
  title,
  message,
  actions,
  compact,
}: {
  title?: string;
  message?: string;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  const { t } = useT();
  return <StateLayout icon="checkCircleFilled" tone="green" title={title ?? t('states.successTitle')} message={message} actions={actions} compact={compact} />;
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

export function SkeletonJobCard() {
  return (
    <Card style={{ gap: 10 }}>
      <Skeleton width="70%" height={18} />
      <Skeleton width="45%" height={14} />
      <Skeleton width="85%" height={14} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <Skeleton width={96} height={26} radius={radii.pill} />
        <Skeleton width={72} height={26} radius={radii.pill} />
      </View>
    </Card>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  const { t } = useT();
  return (
    <View
      accessible
      accessibilityLabel={t('states.loading')}
      accessibilityState={{ busy: true }}
      style={{ marginHorizontal: PAGE_MARGIN, marginTop: 16, gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonJobCard key={i} />
      ))}
    </View>
  );
}
