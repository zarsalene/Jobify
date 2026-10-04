import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { confirmedItems, suggestLinkedIn } from '@/api/mock/assistant';
import type { LinkedInSuggestion } from '@/api/types-assistant';
import { AiFooter, CopyButton } from '@/components/assistant/Bits';
import { UnverifiedNote } from '@/components/domain/Honesty';
import { EmptyState } from '@/components/states';
import { Card, Icon, Padded, Screen, Text } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { profile } from '@/state/profile';
import { radii, useTheme } from '@/theme';

const KIND_TITLE: Record<LinkedInSuggestion['kind'], TKey> = {
  headline: 'assistant.liHeadline',
  about: 'assistant.liAbout',
  skills: 'assistant.liSkills',
  experience: 'assistant.liExperience',
};

function SuggestionCard({ s }: { s: LinkedInSuggestion }) {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text variant="headline" accessibilityRole="header">
          {t(KIND_TITLE[s.kind])}
        </Text>
        {s.heading ? (
          <Text variant="footnote" color="secondaryLabel">
            {s.heading}
          </Text>
        ) : null}
      </View>
      <View style={{ backgroundColor: colors.cardNested, borderRadius: radii.md, padding: 12 }}>
        <Text variant="callout" selectable>
          {s.text}
        </Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text variant="footnote" color="secondaryLabel" weight="600">
          {t('prepare.why')}
        </Text>
        <Text variant="subheadline" color="secondaryLabel">
          {s.why}
        </Text>
      </View>
      {s.unverifiedNote ? <UnverifiedNote>{s.unverifiedNote}</UnverifiedNote> : null}
      <AiFooter sources={s.sources} />
      {/* Copy only. This screen never posts or edits anything on LinkedIn. */}
      <CopyButton text={s.text} size="medium" fullWidth />
    </Card>
  );
}

export default function LinkedInScreen() {
  const { t } = useT();
  const cv = profile.use((s) => s.cv);
  const setup = profile.use((s) => s.setup);
  const items = useMemo(() => confirmedItems(cv?.items), [cv]);
  const suggestions = useMemo(() => suggestLinkedIn(items, setup), [items, setup]);
  const title = <Stack.Screen options={{ title: t('assistant.toolLinkedIn') }} />;

  if (!items.length) {
    return (
      <Screen>
        {title}
        <EmptyState icon="briefcaseUser" title={t('assistant.noCvTitle')} message={t('assistant.noCvBody')} actionLabel={t('assistant.reviewCv')} onAction={() => router.push('/cv')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {title}
      <Padded style={{ marginTop: 12, gap: 12 }}>
        <Text variant="subheadline" color="secondaryLabel">
          {t('assistant.liIntro')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Icon name="shield" size={16} color="greenText" />
          <Text variant="footnote" color="greenText" weight="600" style={{ flex: 1 }}>
            {t('assistant.liCopyOnly')}
          </Text>
        </View>
      </Padded>

      <Padded style={{ marginTop: 16, gap: 12 }}>
        {suggestions.length === 0 ? (
          <Text variant="subheadline" color="secondaryLabel">
            {t('assistant.noSuggestions')}
          </Text>
        ) : (
          suggestions.map((s) => <SuggestionCard key={s.id} s={s} />)
        )}
      </Padded>

      <Padded style={{ marginTop: 16 }}>
        <Text variant="footnote" color="secondaryLabel" style={{ marginHorizontal: 16 }}>
          {t('assistant.liFootnote')}
        </Text>
      </Padded>
    </Screen>
  );
}
