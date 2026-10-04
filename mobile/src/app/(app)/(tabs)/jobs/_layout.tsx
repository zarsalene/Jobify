import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/useStackOptions';
import { useT } from '@/i18n';

export default function JobsLayout() {
  const options = useStackOptions({ largeTitle: true });
  const { t } = useT();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: t('tabs.jobs') }} />
    </Stack>
  );
}
