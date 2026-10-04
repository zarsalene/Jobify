import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Screen, Text } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { profile, saveConsent } from '@/state/profile';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';

type Key = 'data' | 'ai' | 'analytics';

const ITEMS: { key: Key; title: TKey; body: TKey; required: boolean }[] = [
  { key: 'data', title: 'consent.dataTitle', body: 'consent.dataBody', required: true },
  { key: 'ai', title: 'consent.aiTitle', body: 'consent.aiBody', required: false },
  { key: 'analytics', title: 'consent.analyticsTitle', body: 'consent.analyticsBody', required: false },
];

function nextStep() {
  const s = profile.get();
  if (!s.setupDone) return '/setup';
  if (!s.cvDone) return '/cv-upload';
  return null;
}

export default function ConsentScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // None are pre-ticked, ever.
  const [values, setValues] = useState<Record<Key, boolean>>({ data: false, ai: false, analytics: false });
  const consentDone = profile.use((s) => s.consentDone);

  // Resume a half-finished onboarding after a relaunch.
  useEffect(() => {
    if (consentDone) {
      const step = nextStep();
      if (step) router.replace(step);
    }
  }, [consentDone]);

  function submit() {
    saveConsent(values);
    haptics.success();
    router.replace('/setup');
  }

  return (
    <Screen
      plain
      footer={
        <View style={{ gap: 8 }}>
          {!values.data ? (
            <Text variant="footnote" color="secondaryLabel" align="center">
              {t('consent.needData')}
            </Text>
          ) : !values.ai ? (
            <Text variant="footnote" color="secondaryLabel" align="center">
              {t('consent.withoutAi')}
            </Text>
          ) : null}
          <Button title={t('consent.continue')} onPress={submit} disabled={!values.data} haptic="none" />
        </View>
      }>
      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: insets.top + 24, gap: 8 }}>
        <Text variant="largeTitle" accessibilityRole="header">
          {t('consent.title')}
        </Text>
        <Text variant="callout" color="secondaryLabel">
          {t('consent.subtitle')}
        </Text>
      </View>

      <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 24, gap: 12 }}>
        {ITEMS.map((item) => (
          <View key={item.key} style={{ backgroundColor: colors.cardNested, borderRadius: radii.lg + 2, padding: 16, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text variant="headline">{t(item.title)}</Text>
                <Chip label={item.required ? t('consent.required') : t('consent.optional')} size="sm" tone={item.required ? 'accent' : 'neutral'} />
              </View>
              <Switch
                value={values[item.key]}
                onValueChange={(v) => {
                  haptics.select();
                  setValues((prev) => ({ ...prev, [item.key]: v }));
                }}
                trackColor={{ true: colors.green, false: colors.fillSecondary }}
                accessibilityLabel={t(item.title)}
              />
            </View>
            <Text variant="subheadline" color="secondaryLabel">
              {t(item.body)}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
