import { useState } from 'react';
import { View } from 'react-native';

import { Button, Icon, Row, Screen, Section, Text, TextField, type IconName } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { resetData } from '@/state/data';
import { resetNotifications } from '@/state/notifications';
import { resetProfile } from '@/state/profile';
import { logOut } from '@/state/session';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';

/** Typed confirmation word. Intentionally not translated: it is the same in every language. */
const CONFIRM_WORD = 'DELETE';

const ITEMS: { icon: IconName; title: TKey }[] = [
  { icon: 'gear', title: 'settings.deleteItemProfile' },
  { icon: 'document', title: 'settings.deleteItemCv' },
  { icon: 'bookmark', title: 'settings.deleteItemJobs' },
  { icon: 'key', title: 'settings.deleteItemSession' },
];

export default function DeleteAccountScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmed = typed.trim() === CONFIRM_WORD;
  const showError = typed.length > 0 && !confirmed;

  async function confirmDelete() {
    // Nothing happens unless the word was typed.
    if (!confirmed || busy) return;
    setBusy(true);
    haptics.warning();
    try {
      // The backend has no delete endpoint yet: wipe what is on this device, then sign out.
      resetData();
      resetProfile();
      resetNotifications();
      await logOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 12 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('settings.deleteIntro')}
        </Text>
      </View>

      <Section header={t('settings.deleteWhatHeader')} separatorInset={57}>
        {ITEMS.map((i) => (
          <Row key={i.title} icon={i.icon} iconColor={colors.red} title={t(i.title)} />
        ))}
      </Section>

      <Section header={t('settings.deleteGoneHeader')}>
        <View style={{ flexDirection: 'row', gap: 10, padding: PAGE_MARGIN, alignItems: 'flex-start' }}>
          <Icon name="warning" size={18} color="redText" />
          <Text variant="subheadline" style={{ flex: 1 }}>
            {t('settings.deleteGoneBody')}
          </Text>
        </View>
      </Section>

      <View
        accessible
        style={{
          flexDirection: 'row',
          gap: 8,
          padding: 12,
          marginTop: 20,
          marginHorizontal: PAGE_MARGIN,
          borderRadius: radii.md,
          backgroundColor: colors.orangeTint,
          alignItems: 'flex-start',
        }}>
        <Icon name="info" size={16} color="orangeText" />
        <Text variant="footnote" color="orangeText" style={{ flex: 1 }}>
          {t('settings.deleteServerNote')}
        </Text>
      </View>

      <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 24, gap: 16 }}>
        <TextField
          label={t('settings.deleteConfirmLabel', { word: CONFIRM_WORD })}
          hint={t('settings.deleteConfirmHint')}
          error={showError ? t('settings.deleteConfirmError', { word: CONFIRM_WORD }) : undefined}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          returnKeyType="done"
          editable={!busy}
        />
        <Button
          title={busy ? t('settings.deleting') : t('settings.deleteButton')}
          variant="destructiveFilled"
          icon="trash"
          disabled={!confirmed}
          loading={busy}
          haptic="none"
          onPress={confirmDelete}
        />
      </View>
    </Screen>
  );
}
