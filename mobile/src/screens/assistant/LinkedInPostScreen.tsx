import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { buildPostApproval, confirmedItems, draftPost } from '@/api/mock/assistant';
import type { GeneratedText, Tone } from '@/api/types-assistant';
import { AiFooter, ToneControl } from '@/components/assistant/Bits';
import { PermissionBadge, UnverifiedNote } from '@/components/domain/Honesty';
import { EmptyState, OfflineHint } from '@/components/states';
import { Button, Card, Chip, Icon, Padded, Screen, Text, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { registerApproval } from '@/state/data';
import { profile } from '@/state/profile';

const MAX_POST = 3000;

export default function LinkedInPostScreen() {
  const { t } = useT();
  const { online } = useNetwork();
  const cv = profile.use((s) => s.cv);
  const setup = profile.use((s) => s.setup);
  const items = useMemo(() => confirmedItems(cv?.items), [cv]);

  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<Tone>('friendly');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedText | null>(null);
  const [text, setText] = useState('');
  const [edited, setEdited] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestedId, setRequestedId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function generate() {
    if (generating) return;
    setGenerating(true);
    setRequestedId(null);
    timer.current = setTimeout(() => {
      const r = draftPost(topic, tone, items, setup);
      setResult(r);
      setText(r.text);
      setEdited(false);
      setGenerating(false);
      haptics.success();
    }, 1000);
  }

  async function requestApproval() {
    if (requesting || !text.trim()) return;
    setRequesting(true);
    setError(false);
    try {
      // Builds a PENDING approval and opens it. Nothing is published from this screen.
      const approval = await registerApproval(buildPostApproval(text.trim(), [t('common.yourCv')]));
      setRequestedId(approval.id);
      haptics.tap();
      router.push(`/approval/${approval.id}`);
    } catch {
      setError(true);
      haptics.error();
    } finally {
      setRequesting(false);
    }
  }

  const title = <Stack.Screen options={{ title: t('assistant.toolPost') }} />;

  if (!items.length) {
    return (
      <Screen>
        {title}
        <EmptyState icon="megaphone" title={t('assistant.noCvTitle')} message={t('assistant.noCvBody')} actionLabel={t('assistant.reviewCv')} onAction={() => router.push('/cv')} />
      </Screen>
    );
  }

  const tooLong = text.length > MAX_POST;

  return (
    <Screen>
      {title}
      <Padded style={{ marginTop: 12, gap: 12 }}>
        <Text variant="subheadline" color="secondaryLabel">
          {t('assistant.postIntro')}
        </Text>
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="info" size={18} color="secondaryLabel" />
          <Text variant="footnote" color="secondaryLabel" style={{ flex: 1 }}>
            {t('assistant.postNotConnected')}
          </Text>
        </Card>
      </Padded>

      <Padded style={{ marginTop: 16, gap: 12 }}>
        <TextField
          label={t('assistant.postTopic')}
          hint={t('assistant.postTopicHint')}
          placeholder={t('assistant.postTopicPlaceholder')}
          value={topic}
          onChangeText={setTopic}
          maxLength={200}
        />
        <View style={{ gap: 6 }}>
          <Text variant="footnote" color="secondaryLabel" weight="500">
            {t('assistant.tone')}
          </Text>
          <ToneControl value={tone} onChange={setTone} />
        </View>
        <Button
          title={result ? t('common.regenerate') : t('assistant.generate')}
          icon={result ? 'refresh' : 'wand'}
          variant={result ? 'gray' : 'filled'}
          loading={generating}
          disabled={!online}
          onPress={generate}
        />
        <OfflineHint />
      </Padded>

      {result ? (
        <Padded style={{ marginTop: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <AiFooter sources={result.sources} />
            {edited ? <Chip label={t('prepare.edited')} icon="pencil" size="sm" /> : null}
          </View>
          <TextField
            label={t('assistant.postDraft')}
            value={text}
            multiline
            scrollEnabled={false}
            onChangeText={(v) => {
              setText(v);
              setEdited(true);
            }}
            error={tooLong ? t('assistant.postTooLong', { max: MAX_POST }) : undefined}
            hint={t('assistant.postCount', { count: text.length, max: MAX_POST })}
            style={{ minHeight: 200 }}
          />
          {result.unverifiedNotes.map((n) => (
            <UnverifiedNote key={n}>{n}</UnverifiedNote>
          ))}

          <Card style={{ gap: 10 }}>
            <Text variant="headline">{t('assistant.postApprovalHeading')}</Text>
            <PermissionBadge level="public" explain />
            <Text variant="footnote" color="secondaryLabel">
              {t('assistant.postApprovalBody')}
            </Text>
            <Button
              title={t('assistant.requestPublish')}
              icon="megaphone"
              loading={requesting}
              disabled={!online || !text.trim() || tooLong}
              onPress={requestApproval}
            />
            <OfflineHint />
            {error ? (
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} accessibilityLiveRegion="polite">
                <Icon name="shield" size={16} color="greenText" />
                <Text variant="footnote" color="greenText" weight="600" style={{ flex: 1 }}>
                  {t('assistant.postRequestFailed')}
                </Text>
              </View>
            ) : null}
            {requestedId ? (
              <Button title={t('assistant.openApprovalDone')} variant="plain" size="medium" onPress={() => router.push(`/approval/${requestedId}`)} />
            ) : null}
          </Card>
        </Padded>
      ) : null}

      <Padded style={{ marginTop: 20 }}>
        <Text variant="footnote" color="secondaryLabel" style={{ marginHorizontal: 16 }}>
          {t('assistant.postFootnote')}
        </Text>
      </Padded>
    </Screen>
  );
}
