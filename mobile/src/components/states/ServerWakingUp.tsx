import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { serverStatus } from '@/api';
import { ProgressBar } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useT } from '@/i18n';
import { radii, useTheme } from '@/theme';

/**
 * Appears automatically (via the API client) when a request is taking long
 * enough that the host is probably cold-starting. Pass `force` to render it
 * unconditionally (e.g. in a state gallery).
 */
export function ServerWakingUp({ force }: { force?: boolean }) {
  const waking = serverStatus.use((s) => s.waking);
  const since = serverStatus.use((s) => s.since);
  const { colors } = useTheme();
  const { t } = useT();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!waking && !force) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waking, force]);

  if (!waking && !force) return null;
  const seconds = since ? Math.max(0, Math.round((now - since) / 1000)) : 0;

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={t('states.waking')}
      style={{ padding: 14, borderRadius: radii.md + 2, backgroundColor: colors.card, gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Icon name="server" size={20} color="accent" />
        <Text variant="subheadline" weight="600" style={{ flex: 1 }}>
          {t('states.waking')}
        </Text>
      </View>
      <ProgressBar indeterminate />
      <Text variant="footnote" color="secondaryLabel">
        {t('states.wakingBody')} {since ? t('states.wakingElapsed', { seconds }) : ''}
      </Text>
    </View>
  );
}
