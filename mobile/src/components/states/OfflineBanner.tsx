import { View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useT } from '@/i18n';
import { useNetwork } from '@/lib/network';
import { radii, useTheme } from '@/theme';

/** Shown whenever the device is offline. Says what still works. */
export function OfflineBanner() {
  const { online } = useNetwork();
  const { colors } = useTheme();
  const { t } = useT();
  if (online) return null;
  return (
    <View
      accessible
      accessibilityRole="alert"
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
  );
}

/** Inline explanation shown under a button that is disabled because the device is offline. */
export function OfflineHint() {
  const { online } = useNetwork();
  const { t } = useT();
  if (online) return null;
  return (
    <Text variant="footnote" color="secondaryLabel" align="center" style={{ marginTop: 6 }}>
      {t('common.offlineExplain')}
    </Text>
  );
}
