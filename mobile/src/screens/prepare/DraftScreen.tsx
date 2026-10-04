import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import type { Draft, DraftKind } from '@/api/types';
import { AiBadge, SourceNote, UnverifiedNote } from '@/components/domain/Honesty';
import { EmptyState } from '@/components/states';
import { OfflineHint } from '@/components/states/OfflineBanner';
import { Button, Chip, HeaderButton, Row, Screen, SegmentedControl, Section, Text, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { data, regenerateDraft, saveDraft } from '@/state/data';
import { PAGE_MARGIN } from '@/theme';

type Tone = 'formal' | 'friendly' | 'concise';

/** Preview and edit one generated document. Always labelled AI-assisted, with its sources. */
export default function DraftScreen() {
  const { runId, kind } = useLocalSearchParams<{ runId: string; kind: DraftKind }>();
  const { t } = useT();
  const { online } = useNetwork();
  const run = data.use((s) => s.runs[runId]);
  const draft: Draft | undefined = run?.drafts[kind];

  const [body, setBody] = useState(draft?.body ?? '');
  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [tone, setTone] = useState<Tone>('formal');
  const [busy, setBusy] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  // Keep local text in sync when a regenerate replaces the draft.
  useEffect(() => {
    if (draft) {
      setBody(draft.body);
      setSubject(draft.subject ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id]);

  if (!draft) {
    return (
      <Screen>
        <EmptyState icon="document" title={t('prepare.docWaiting')} />
      </Screen>
    );
  }

  const dirty = body !== draft.body || subject !== (draft.subject ?? '');

  async function commit() {
    if (!dirty || !draft) return;
    await saveDraft(runId, { ...draft, body, subject: draft.kind === 'email' ? subject : draft.subject });
    haptics.success();
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 1800);
  }

  async function doRegenerate() {
    setBusy(true);
    try {
      await regenerateDraft(runId, kind, tone);
      haptics.success();
    } finally {
      setBusy(false);
    }
  }

  function regenerate() {
    if (draft?.edited || dirty) {
      Alert.alert(t('prepare.regenerateTitle'), t('prepare.regenerateBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('prepare.regenerate'), style: 'destructive', onPress: () => void doRegenerate() },
      ]);
    } else void doRegenerate();
  }

  const canRegenerate = kind !== 'cv';

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: draft.title,
          headerRight: () => (
            <HeaderButton
              text={t('common.done')}
              label={t('common.done')}
              bold
              onPress={async () => {
                await commit();
                router.back();
              }}
            />
          ),
        }}
      />

      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: 8, gap: 10 }}>
        <Text variant="title1" accessibilityRole="header">
          {draft.title}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <AiBadge />
          {draft.edited ? <Chip label={t('prepare.edited')} icon="pencil" size="sm" /> : null}
          {savedNote ? <Chip label={t('prepare.savedDraft')} icon="check" tone="green" size="sm" /> : null}
        </View>
        <SourceNote sources={draft.sources} />
      </View>

      {draft.unverifiedNotes?.length ? (
        <View style={{ paddingHorizontal: PAGE_MARGIN, marginTop: 16, gap: 8 }}>
          <UnverifiedNote>{draft.unverifiedNotes.join(' ')}</UnverifiedNote>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: PAGE_MARGIN, marginTop: 20, gap: 16 }}>
        {kind === 'email' ? (
          <TextField label={t('prepare.subject')} value={subject} onChangeText={setSubject} onBlur={commit} />
        ) : null}
        <TextField
          label={kind === 'cv' ? t('prepare.docCv') : t('prepare.body')}
          value={body}
          onChangeText={setBody}
          onBlur={commit}
          multiline
          style={{ minHeight: 260 }}
          scrollEnabled={false}
        />
      </View>

      {canRegenerate ? (
        <View style={{ paddingHorizontal: PAGE_MARGIN, marginTop: 20, gap: 10 }}>
          <Text variant="footnote" color="secondaryLabel" weight="500">
            {t('prepare.tone')}
          </Text>
          <SegmentedControl
            accessibilityLabel={t('prepare.tone')}
            value={tone}
            onChange={setTone}
            options={[
              { value: 'formal', label: t('prepare.toneFormal') },
              { value: 'friendly', label: t('prepare.toneFriendly') },
              { value: 'concise', label: t('prepare.toneConcise') },
            ]}
          />
          <Button title={t('prepare.regenerate')} icon="refresh" variant="gray" size="medium" loading={busy} disabled={!online} onPress={regenerate} />
          {!online ? <OfflineHint /> : null}
        </View>
      ) : (
        <Section>
          <Row
            title={t('prepare.reviewChanges')}
            subtitle={t('prepare.cvChangesCount', { count: run?.cvChanges.length ?? 0 })}
            icon="swap"
            onPress={() => router.push(`/cv-diff/${runId}`)}
          />
        </Section>
      )}
    </Screen>
  );
}
