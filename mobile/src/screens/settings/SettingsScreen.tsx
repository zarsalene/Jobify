import { router } from 'expo-router';
import { Alert } from 'react-native';

import { Row, RowBody, Screen, SegmentedControl, Section } from '@/components/ui';
import { APP_NAME, APP_VERSION } from '@/constants/app';
import { LOCALE_NAMES, useT } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { preferences, setTheme, type ThemePref } from '@/state/preferences';
import { profile, updateConsent } from '@/state/profile';
import { logOut, session } from '@/state/session';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const user = session.use((s) => s.user);
  const theme = preferences.use((s) => s.theme);
  const language = preferences.use((s) => s.language);
  const consent = profile.use((s) => s.consent);

  const languageValue = language === 'system' ? t('settings.languageSystem') : LOCALE_NAMES[language];

  function confirmLogOut() {
    Alert.alert(t('settings.logOutTitle', { app: APP_NAME }), t('settings.logOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logOutConfirm'),
        style: 'destructive',
        onPress: () => {
          haptics.warning();
          void logOut();
        },
      },
    ]);
  }

  function setDataConsent(on: boolean) {
    if (on) {
      updateConsent({ data: true });
      return;
    }
    Alert.alert(t('settings.dataOffTitle'), t('settings.dataOffBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.dataOffConfirm'),
        style: 'destructive',
        onPress: () => {
          haptics.warning();
          updateConsent({ data: false });
        },
      },
    ]);
  }

  return (
    <Screen>
      <Section header={t('settings.accountHeader')} separatorInset={57}>
        <Row
          icon="personCircle"
          iconColor={colors.secondaryLabel}
          title={user?.full_name || t('settings.accountFallbackName')}
          subtitle={user?.email}
        />
        <Row icon="logout" iconColor={colors.red} title={t('settings.logOut')} destructive onPress={confirmLogOut} chevron={false} />
      </Section>

      <Section separatorInset={57}>
        <Row icon="globe" title={t('settings.language')} value={languageValue} onPress={() => router.push('/settings/language')} />
        <Row icon="bell" iconColor={colors.red} title={t('notifications.title')} onPress={() => router.push('/notification-settings')} />
      </Section>

      <Section header={t('settings.appearanceHeader')} footer={t('settings.appearanceFooter')}>
        <RowBody>
          <SegmentedControl<ThemePref>
            accessibilityLabel={t('settings.appearanceLabel')}
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'system', label: t('settings.themeSystem') },
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
            ]}
          />
        </RowBody>
      </Section>

      <Section
        header={t('settings.aiHeader')}
        footer={consent.ai ? t('settings.aiFooter') : `${t('settings.aiOffNote')}\n\n${t('settings.aiFooter')}`}>
        <Row
          title={t('settings.consentDataTitle')}
          subtitle={t('settings.consentDataBody')}
          switchValue={consent.data}
          onSwitchChange={setDataConsent}
        />
        <Row
          title={t('settings.consentAiTitle')}
          subtitle={t('settings.consentAiBody')}
          switchValue={consent.ai}
          onSwitchChange={(v) => updateConsent({ ai: v })}
        />
        <Row
          title={t('settings.consentAnalyticsTitle')}
          subtitle={t('settings.consentAnalyticsBody')}
          switchValue={consent.analytics}
          onSwitchChange={(v) => updateConsent({ analytics: v })}
        />
      </Section>

      <Section separatorInset={57}>
        <Row icon="link" iconColor={colors.green} title={t('settings.integrations')} onPress={() => router.push('/settings/integrations')} />
        <Row icon="gauge" iconColor={colors.orange} title={t('settings.usage')} onPress={() => router.push('/settings/usage')} />
      </Section>

      <Section header={t('settings.dataHeader')} separatorInset={57}>
        <Row icon="download" title={t('settings.dataExport')} onPress={() => router.push('/settings/data-export')} />
        <Row icon="lock" iconColor={colors.green} title={t('settings.privacy')} onPress={() => router.push('/settings/privacy')} />
        <Row icon="document" iconColor={colors.secondaryLabel} title={t('settings.legal')} onPress={() => router.push('/settings/legal')} />
      </Section>

      <Section separatorInset={57}>
        <Row
          icon="trash"
          iconColor={colors.red}
          title={t('settings.deleteAccount')}
          destructive
          onPress={() => router.push('/settings/delete-account')}
        />
      </Section>

      <Section separatorInset={57}>
        <Row icon="tools" iconColor={colors.secondaryLabel} title={t('settings.sampleTools')} onPress={() => router.push('/settings/sample-tools')} />
      </Section>

      <Section header={t('settings.aboutHeader')} footer={t('settings.buildNote')}>
        <Row title={APP_NAME} value={`${t('settings.version')} ${APP_VERSION}`} />
      </Section>
    </Screen>
  );
}
