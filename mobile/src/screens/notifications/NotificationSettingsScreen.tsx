import { View } from 'react-native';

import { Icon, Row, Screen, Section, Text, type IconName } from '@/components/ui';
import { TimePickerRow, formatMinutes } from '@/components/settings/TimePickerRow';
import { useT, type TKey } from '@/i18n';
import { preferences, setNotificationType, setQuietHours, type NotificationType } from '@/state/preferences';
import { PAGE_MARGIN } from '@/theme';

const TYPES: { type: NotificationType; title: TKey; body: TKey; icon: IconName }[] = [
  { type: 'approvals', title: 'notifications.typeApprovals', body: 'notifications.typeApprovalsBody', icon: 'checklist' },
  { type: 'applications', title: 'notifications.typeApplications', body: 'notifications.typeApplicationsBody', icon: 'applications' },
  { type: 'matches', title: 'notifications.typeMatches', body: 'notifications.typeMatchesBody', icon: 'target' },
  { type: 'reminders', title: 'notifications.typeReminders', body: 'notifications.typeRemindersBody', icon: 'clock' },
  { type: 'system', title: 'notifications.typeSystem', body: 'notifications.typeSystemBody', icon: 'info' },
];

export default function NotificationSettingsScreen() {
  const { t, locale } = useT();
  const prefs = preferences.use((s) => s.notifications);
  const quiet = preferences.use((s) => s.quietHours);

  return (
    <Screen>
      <Section header={t('notifications.settingsTypesHeader')} footer={t('notifications.settingsTypesFooter')} separatorInset={57}>
        {TYPES.map((item) => (
          <Row
            key={item.type}
            icon={item.icon}
            title={t(item.title)}
            subtitle={t(item.body)}
            switchValue={prefs[item.type]}
            onSwitchChange={(v) => setNotificationType(item.type, v)}
          />
        ))}
      </Section>

      <Section
        header={t('notifications.quietHoursHeader')}
        footer={quiet.enabled ? t('notifications.quietSummary', { start: formatMinutes(quiet.start, locale), end: formatMinutes(quiet.end, locale) }) : undefined}>
        <Row
          title={t('notifications.quietHours')}
          subtitle={t('notifications.quietHoursFooter')}
          switchValue={quiet.enabled}
          onSwitchChange={(v) => setQuietHours({ enabled: v })}
        />
        {quiet.enabled ? (
          <TimePickerRow label={t('notifications.quietFrom')} minutes={quiet.start} onChange={(m) => setQuietHours({ start: m })} />
        ) : null}
        {quiet.enabled ? (
          <TimePickerRow label={t('notifications.quietUntil')} minutes={quiet.end} onChange={(m) => setQuietHours({ end: m })} />
        ) : null}
      </Section>

      <Section header={t('notifications.pushHeader')}>
        <View style={{ flexDirection: 'row', gap: 10, padding: PAGE_MARGIN, alignItems: 'flex-start' }}>
          <Icon name="info" size={18} color="secondaryLabel" />
          <Text variant="subheadline" color="secondaryLabel" style={{ flex: 1 }}>
            {t('notifications.pushNotConnected')}
          </Text>
        </View>
      </Section>
    </Screen>
  );
}
