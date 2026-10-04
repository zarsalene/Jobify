import { View } from 'react-native';

import { Button, Icon, Screen, Section, Text, type IconName } from '@/components/ui';
import { APP_NAME } from '@/constants/app';
import { useT, type TKey } from '@/i18n';
import { PAGE_MARGIN, useTheme } from '@/theme';

const ITEMS: { key: string; icon: IconName; title: TKey; body: TKey }[] = [
  { key: 'gmail', icon: 'envelope', title: 'settings.intGmail', body: 'settings.intGmailBody' },
  { key: 'outlook', icon: 'envelope', title: 'settings.intOutlook', body: 'settings.intOutlookBody' },
  { key: 'linkedin', icon: 'link', title: 'settings.intLinkedIn', body: 'settings.intLinkedInBody' },
  { key: 'calendar', icon: 'calendar', title: 'settings.intCalendar', body: 'settings.intCalendarBody' },
];

function IntegrationItem({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View style={{ padding: PAGE_MARGIN, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View
          style={{
            width: 29,
            height: 29,
            borderRadius: 7,
            backgroundColor: colors.secondaryLabel,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name={icon} size={17} color="#FFFFFF" weight="medium" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body">{title}</Text>
          <Text variant="subheadline" color="secondaryLabel">
            {body}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Icon name="minusCircle" size={14} color="secondaryLabel" />
            <Text variant="footnote" color="secondaryLabel" weight="600">
              {t('settings.notConnected')}
            </Text>
          </View>
        </View>
      </View>
      <View style={{ gap: 6, paddingStart: 41 }}>
        <Button title={t('settings.connect')} variant="gray" size="medium" disabled haptic="none" accessibilityHint={t('settings.notAvailable')} />
        <Text variant="footnote" color="secondaryLabel">
          {t('settings.notAvailable')}
        </Text>
      </View>
    </View>
  );
}

export default function IntegrationsScreen() {
  const { t } = useT();
  return (
    <Screen>
      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 12 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('settings.integrationsIntro', { app: APP_NAME })}
        </Text>
      </View>
      <Section header={t('settings.integrationsHeader')} footer={t('settings.integrationsFooter')}>
        {ITEMS.map((i) => (
          <IntegrationItem key={i.key} icon={i.icon} title={t(i.title)} body={t(i.body)} />
        ))}
      </Section>
    </Screen>
  );
}
