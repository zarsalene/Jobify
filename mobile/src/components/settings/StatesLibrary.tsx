import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  ParsingProblem,
  ServerWakingUp,
  SkeletonList,
  Success,
  UsageLimit,
} from '@/components/states';
import { Icon, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';

/** One labelled block of the library, styled like an inset-grouped section. */
function Block({ header, footer, children }: { header: string; footer?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 20, marginHorizontal: PAGE_MARGIN }}>
      <Text
        variant="footnote"
        color="secondaryLabel"
        accessibilityRole="header"
        style={{ textTransform: 'uppercase', marginBottom: 6, marginHorizontal: 16 }}>
        {header}
      </Text>
      <View style={{ backgroundColor: colors.card, borderRadius: radii.md + 2, overflow: 'hidden' }}>{children}</View>
      {footer ? (
        <Text variant="footnote" color="secondaryLabel" style={{ marginTop: 6, marginHorizontal: 16 }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/** Static copy of the offline banner markup: the real one only renders while the device is offline. */
function OfflineBannerExample() {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View style={{ padding: 12 }}>
      <View
        accessible
        accessibilityLabel={t('states.offlineBannerA11y')}
        style={{
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
          padding: 12,
          borderRadius: radii.md + 2,
          backgroundColor: colors.orangeTint,
        }}>
        <Icon name="offline" size={20} color="orangeText" />
        <Text variant="footnote" color="orangeText" style={{ flex: 1 }}>
          {t('states.offlineBanner')}
        </Text>
      </View>
    </View>
  );
}

/** Every shared state component, stacked, so a reviewer can see them all in one scroll. */
export function StatesLibrary() {
  const { t } = useT();
  const noop = () => {};
  return (
    <>
      <Block header={t('settings.libSkeleton')}>
        <SkeletonList count={2} />
        <View style={{ height: 16 }} />
      </Block>

      <Block header={t('settings.libEmpty')}>
        <EmptyState
          compact
          icon="bookmark"
          title={t('settings.libEmptyTitle')}
          message={t('settings.libEmptyBody')}
          actionLabel={t('settings.libEmptyAction')}
          onAction={() => router.navigate('/jobs')}
        />
      </Block>

      <Block header={t('settings.libError')}>
        <ErrorState compact onRetry={noop} />
      </Block>

      <Block header={t('settings.libOffline')} footer={t('settings.libOfflineNote')}>
        <OfflineBannerExample />
      </Block>

      <Block header={t('settings.libWaking')}>
        <View style={{ padding: 12 }}>
          <ServerWakingUp force />
        </View>
      </Block>

      <Block header={t('settings.libUsage')}>
        <UsageLimit what={t('settings.usageDemoWhat')} used={20} limit={20} resetsOn="1 Jan" />
      </Block>

      <Block header={t('settings.libParsing')}>
        <ParsingProblem onRetry={noop} onManual={noop} />
      </Block>

      <Block header={t('settings.libSuccess')}>
        <Success compact title={t('settings.libSuccessTitle')} message={t('settings.libSuccessBody')} />
      </Block>
    </>
  );
}
