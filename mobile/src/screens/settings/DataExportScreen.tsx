import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { OfflineHint, Success } from '@/components/states';
import { Button, Row, Screen, Section, Text, type IconName } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { PAGE_MARGIN } from '@/theme';

const CONTENTS: { icon: IconName; title: TKey }[] = [
  { icon: 'personCircle', title: 'settings.exportProfile' },
  { icon: 'document', title: 'settings.exportCv' },
  { icon: 'bookmark', title: 'settings.exportJobs' },
  { icon: 'compose', title: 'settings.exportDrafts' },
  { icon: 'shield', title: 'settings.exportConsent' },
];

export default function DataExportScreen() {
  const { t } = useT();
  const { online } = useNetwork();
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'done'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function request() {
    setPhase('requesting');
    // Simulated: no request leaves the device and no file is produced.
    timer.current = setTimeout(() => {
      haptics.success();
      setPhase('done');
    }, 1200);
  }

  return (
    <Screen>
      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 12 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('settings.exportIntro')}
        </Text>
      </View>

      <Section header={t('settings.exportHeader')} footer={t('settings.exportNotIncluded')} separatorInset={57}>
        {CONTENTS.map((c) => (
          <Row key={c.title} icon={c.icon} title={t(c.title)} />
        ))}
      </Section>

      {phase === 'done' ? (
        <View style={{ marginTop: 12 }}>
          <Success
            compact
            title={t('settings.exportDoneTitle')}
            message={t('settings.exportDoneBody')}
            actions={<Button title={t('settings.exportDone')} variant="tinted" size="medium" onPress={() => router.back()} />}
          />
        </View>
      ) : (
        <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 24 }}>
          <Button
            title={phase === 'requesting' ? t('settings.exportRequesting') : t('settings.exportRequest')}
            icon="download"
            loading={phase === 'requesting'}
            disabled={!online}
            haptic="tap"
            onPress={request}
          />
          <OfflineHint />
        </View>
      )}
    </Screen>
  );
}
