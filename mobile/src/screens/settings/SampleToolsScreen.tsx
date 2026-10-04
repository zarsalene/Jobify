import { useState } from 'react';
import { Alert, View } from 'react-native';

import { StatesLibrary } from '@/components/settings/StatesLibrary';
import { Row, Screen, Section, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { resetData } from '@/state/data';
import { preferences, setSimulatePrepFailure, setSimulateSendFailure } from '@/state/preferences';
import { PAGE_MARGIN, useTheme } from '@/theme';

export default function SampleToolsScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const sendFail = preferences.use((s) => s.simulateSendFailure);
  const prepFail = preferences.use((s) => s.simulatePrepFailure);
  const [showLibrary, setShowLibrary] = useState(false);

  function confirmReset() {
    Alert.alert(t('settings.sampleResetTitle'), t('settings.sampleResetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.sampleResetConfirm'),
        style: 'destructive',
        onPress: () => {
          haptics.warning();
          resetData();
          Alert.alert(t('settings.sampleResetDone'));
        },
      },
    ]);
  }

  return (
    <Screen>
      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 12 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('settings.sampleIntro')}
        </Text>
      </View>

      <Section header={t('settings.sampleFailuresHeader')} footer={t('settings.sampleFailuresFooter')}>
        <Row title={t('settings.sampleSendFailure')} switchValue={sendFail} onSwitchChange={setSimulateSendFailure} />
        <Row title={t('settings.samplePrepFailure')} switchValue={prepFail} onSwitchChange={setSimulatePrepFailure} />
      </Section>

      <Section header={t('settings.sampleLibraryHeader')} footer={t('settings.sampleLibraryFooter')} separatorInset={57}>
        <Row
          icon="list"
          iconColor={colors.accent}
          title={t('settings.sampleLibraryRow')}
          value={showLibrary ? t('settings.sampleLibraryHide') : t('settings.sampleLibraryShow')}
          onPress={() => setShowLibrary((v) => !v)}
          accessibilityHint={t('settings.sampleLibraryFooter')}
        />
      </Section>

      {showLibrary ? <StatesLibrary /> : null}

      <Section header={t('settings.sampleResetHeader')}>
        <Row title={t('settings.sampleReset')} destructive onPress={confirmReset} chevron={false} />
      </Section>
    </Screen>
  );
}
