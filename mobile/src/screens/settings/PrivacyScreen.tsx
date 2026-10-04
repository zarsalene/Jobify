import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon, Row, RowBody, Screen, Section, Text, type IconName } from '@/components/ui';
import { useT } from '@/i18n';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';

function Line({ icon, text, tone = 'secondaryLabel' }: { icon: IconName; text: string; tone?: 'secondaryLabel' | 'greenText' | 'orangeText' }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 2 }}>
      <View style={{ width: 24, alignItems: 'center', paddingTop: 1 }}>
        <Icon name={icon} size={20} color={tone} />
      </View>
      <Text variant="body" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const { t } = useT();
  const { colors } = useTheme();

  return (
    <Screen>
      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 12 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('settings.privacyIntro')}
        </Text>
      </View>

      <Section header={t('settings.privacyDeviceHeader')} footer={t('settings.privacyDeviceNote')}>
        <RowBody>
          <Line icon="briefcaseUser" text={t('settings.privacyDeviceCv')} />
          <Line icon="cloud" text={t('settings.privacyDeviceCache')} />
        </RowBody>
      </Section>

      <Section header={t('settings.privacySecureHeader')}>
        <RowBody>
          <Line icon="key" text={t('settings.privacySecureBody')} tone="greenText" />
        </RowBody>
      </Section>

      <Section header={t('settings.privacyServerHeader')}>
        <RowBody>
          <Line icon="server" text={t('settings.privacyServerBody')} />
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              padding: 12,
              marginTop: 4,
              borderRadius: radii.md,
              backgroundColor: colors.orangeTint,
              alignItems: 'flex-start',
            }}>
            <Icon name="info" size={16} color="orangeText" />
            <Text variant="footnote" color="orangeText" style={{ flex: 1 }}>
              {t('settings.privacyBuildNote')}
            </Text>
          </View>
        </RowBody>
      </Section>

      <Section header={t('settings.privacyAiHeader')}>
        <RowBody style={{ gap: 12 }}>
          <Line icon="eye" text={t('settings.privacyAiSees')} />
          <Line icon="eyeOff" text={t('settings.privacyAiNever')} />
          <Line icon="hand" text={t('settings.privacyAiNoSend')} tone="greenText" />
        </RowBody>
      </Section>

      <Section header={t('settings.privacyWithdrawHeader')} footer={t('settings.privacyWithdrawBody')} separatorInset={57}>
        <Row icon="download" title={t('settings.privacyExportRow')} onPress={() => router.push('/settings/data-export')} />
        <Row icon="trash" iconColor={colors.red} title={t('settings.privacyDeleteRow')} onPress={() => router.push('/settings/delete-account')} />
      </Section>
    </Screen>
  );
}
