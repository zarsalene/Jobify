import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';

import { confirmedItems, draftCoverLetter } from '@/api/mock/assistant';
import type { GeneratedText, Tone } from '@/api/types-assistant';
import { AiFooter, CopyButton, JobPicker, ToneControl } from '@/components/assistant/Bits';
import { UnverifiedNote } from '@/components/domain/Honesty';
import { EmptyState, OfflineHint } from '@/components/states';
import { Button, Chip, Padded, Screen, SegmentedControl, Text, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { data } from '@/state/data';
import { profile } from '@/state/profile';
import { session } from '@/state/session';

type Format = 'letter' | 'email';

export default function CoverLetterScreen() {
  const params = useLocalSearchParams<{ jobId?: string; auto?: string }>();
  const { t } = useT();
  const { online } = useNetwork();
  const cv = profile.use((s) => s.cv);
  const jobs = data.use((s) => s.jobs);
  const userName = session.use((s) => s.user?.full_name);
  const items = useMemo(() => confirmedItems(cv?.items), [cv]);

  const [jobId, setJobId] = useState<string | null>(params.jobId && jobs[params.jobId] ? params.jobId : null);
  const job = jobId ? jobs[jobId] : undefined;
  const [format, setFormat] = useState<Format>('letter');
  const [tone, setTone] = useState<Tone>('formal');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedText | null>(null);
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [edited, setEdited] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function produce() {
    if (!job) return;
    const r = draftCoverLetter(job, userName?.trim() || t('assistant.namePlaceholder'), items, tone, format);
    setResult(r);
    setBody(r.text);
    setSubject(r.subject ?? '');
    setEdited(false);
  }

  function generate() {
    if (!job || generating) return;
    setGenerating(true);
    timer.current = setTimeout(() => {
      produce();
      setGenerating(false);
      haptics.success();
    }, 1000);
  }

  function regenerate() {
    if (!edited) return generate();
    Alert.alert(t('prepare.regenerateTitle'), t('prepare.regenerateBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.regenerate'), style: 'destructive', onPress: generate },
    ]);
  }

  // Opened from a finished assistant task: show the result straight away.
  const auto = useRef(false);
  useEffect(() => {
    if (params.auto === '1' && !auto.current && job && items.length) {
      auto.current = true;
      produce();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.auto, job, items]);

  function chooseJob(id: string | null) {
    clearTimeout(timer.current);
    setGenerating(false);
    setJobId(id);
    setResult(null);
  }

  const title = <Stack.Screen options={{ title: t('assistant.toolLetter') }} />;

  if (!items.length) {
    return (
      <Screen>
        {title}
        <EmptyState icon="envelope" title={t('assistant.noCvTitle')} message={t('assistant.noCvBody')} actionLabel={t('assistant.reviewCv')} onAction={() => router.push('/cv')} />
      </Screen>
    );
  }

  const copyText = format === 'email' && subject ? `${t('prepare.subject')}: ${subject}\n\n${body}` : body;

  return (
    <Screen>
      {title}
      <Padded style={{ marginTop: 12 }}>
        <Text variant="subheadline" color="secondaryLabel">
          {t('assistant.letterIntro')}
        </Text>
      </Padded>

      <Padded style={{ marginTop: 16, gap: 6 }}>
        <Text variant="footnote" color="secondaryLabel" weight="500" style={{ marginHorizontal: 16 }}>
          {t('assistant.chooseJob')}
        </Text>
        <JobPicker value={jobId} onChange={chooseJob} allowGeneral={false} />
      </Padded>

      <Padded style={{ marginTop: 16, gap: 12 }}>
        <View style={{ gap: 6 }}>
          <Text variant="footnote" color="secondaryLabel" weight="500">
            {t('assistant.format')}
          </Text>
          <SegmentedControl<Format>
            accessibilityLabel={t('assistant.format')}
            value={format}
            onChange={(f) => {
              setFormat(f);
              if (result) setResult(null);
            }}
            options={[
              { value: 'letter', label: t('assistant.formatLetter') },
              { value: 'email', label: t('assistant.formatEmail') },
            ]}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text variant="footnote" color="secondaryLabel" weight="500">
            {t('assistant.tone')}
          </Text>
          <ToneControl value={tone} onChange={setTone} />
        </View>
        {!result ? (
          <View style={{ gap: 6 }}>
            <Button title={t('assistant.generate')} icon="wand" loading={generating} disabled={!job || !online} onPress={generate} />
            {!job ? (
              <Text variant="footnote" color="secondaryLabel" align="center">
                {t('assistant.needJob')}
              </Text>
            ) : null}
            <OfflineHint />
          </View>
        ) : null}
      </Padded>

      {result ? (
        <>
          <Padded style={{ marginTop: 20, gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <AiFooter sources={result.sources} />
              {edited ? <Chip label={t('prepare.edited')} icon="pencil" size="sm" /> : null}
            </View>
            {format === 'email' ? (
              <TextField
                label={t('prepare.subject')}
                value={subject}
                onChangeText={(v) => {
                  setSubject(v);
                  setEdited(true);
                }}
              />
            ) : null}
            <TextField
              label={format === 'email' ? t('prepare.body') : t('assistant.letterLabel')}
              value={body}
              multiline
              scrollEnabled={false}
              onChangeText={(v) => {
                setBody(v);
                setEdited(true);
              }}
              style={{ minHeight: 240 }}
            />
            {result.unverifiedNotes.map((n) => (
              <UnverifiedNote key={n}>{n}</UnverifiedNote>
            ))}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <CopyButton text={copyText} size="medium" fullWidth />
              </View>
              <Button
                title={generating ? t('assistant.working') : t('common.regenerate')}
                icon="refresh"
                variant="gray"
                size="medium"
                disabled={!online || generating}
                loading={generating}
                style={{ flex: 1 }}
                onPress={regenerate}
              />
            </View>
            <OfflineHint />
          </Padded>
        </>
      ) : null}

      <Padded style={{ marginTop: 20, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Text variant="footnote" color="secondaryLabel" style={{ flex: 1 }}>
            {t('assistant.letterFooter')}
          </Text>
        </View>
        {jobId ? <Button title={t('assistant.prepareApplication')} variant="plain" size="medium" onPress={() => router.push(`/prepare/${jobId}`)} /> : null}
      </Padded>
    </Screen>
  );
}
