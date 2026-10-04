import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';

import { Icon, Row, Screen, Section } from '@/components/ui';
import { OfflineHint } from '@/components/states';
import { LEGAL_LINKS } from '@/constants/app';
import { useT, type TKey } from '@/i18n';
import { useNetwork } from '@/lib/network';

const LINKS: { key: keyof typeof LEGAL_LINKS; title: TKey }[] = [
  { key: 'terms', title: 'settings.legalTerms' },
  { key: 'privacy', title: 'settings.legalPrivacy' },
  { key: 'ai', title: 'settings.legalAi' },
];

export default function LegalScreen() {
  const { t } = useT();
  const { online } = useNetwork();

  async function open(url: string) {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert(t('settings.legalError'));
    }
  }

  return (
    <Screen>
      <Section footer={t('settings.legalFooter')}>
        {LINKS.map((l) => (
          <Row
            key={l.key}
            title={t(l.title)}
            disabled={!online}
            chevron={false}
            trailing={<Icon name="openExternal" size={18} color="tertiaryLabel" />}
            onPress={() => void open(LEGAL_LINKS[l.key])}
          />
        ))}
      </Section>
      <OfflineHint />
    </Screen>
  );
}
