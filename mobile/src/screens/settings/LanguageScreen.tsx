import { Alert } from 'react-native';

import { CheckRow } from '@/components/settings/CheckRow';
import { Screen, Section } from '@/components/ui';
import { LOCALE_NAMES, SUPPORTED_LOCALES, t as tNow, useT, type Locale } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { preferences, setLanguage } from '@/state/preferences';

export default function LanguageScreen() {
  const { t } = useT();
  const current = preferences.use((s) => s.language);

  function choose(lang: Locale | 'system') {
    if (lang === current) return;
    const { needsRestart } = setLanguage(lang);
    if (needsRestart) {
      haptics.warning();
      // tNow reads the language that was just applied, so the alert is in the new language.
      Alert.alert(tNow('settings.restartTitle'), tNow('settings.restartBody'), [{ text: tNow('settings.restartOk') }]);
    } else {
      haptics.success();
    }
  }

  return (
    <Screen>
      <Section header={t('settings.languageHeader')} footer={t('settings.languageFooter')}>
        <CheckRow title={t('settings.languageSystem')} selected={current === 'system'} onPress={() => choose('system')} />
        {SUPPORTED_LOCALES.map((l) => (
          <CheckRow key={l} title={LOCALE_NAMES[l]} selected={current === l} onPress={() => choose(l)} />
        ))}
      </Section>
    </Screen>
  );
}
