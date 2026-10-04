import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { confirmedItems, renderCvDraft, suggestCvChanges } from '@/api/mock/assistant';
import type { CvSuggestion, SuggestionDecision } from '@/api/types-assistant';
import { AiFooter, CopyButton, JobPicker } from '@/components/assistant/Bits';
import { STEP_LABEL } from '@/components/assistant/meta';
import { SourceNote, UnverifiedNote } from '@/components/domain/Honesty';
import { StepRow } from '@/components/domain/StepRow';
import { EmptyState, OfflineHint } from '@/components/states';
import { Button, Card, Chip, Padded, Row, Screen, Section, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { assistant, ensureAssistantHydrated, saveCvDraft } from '@/state/assistant';
import { data } from '@/state/data';
import { profile } from '@/state/profile';
import { radii, useTheme } from '@/theme';

type Stage = 'idle' | 'working' | 'ready';

/** One side of the comparison. */
function Pane({ label, text, suggested }: { label: string; text: string; suggested?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text variant="caption1" color="secondaryLabel" weight="600" style={{ textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View
        style={{
          backgroundColor: colors.cardNested,
          borderRadius: radii.md,
          padding: 12,
          borderWidth: suggested ? 1 : 0,
          borderColor: colors.accent,
        }}>
        <Text variant="callout" selectable>
          {text}
        </Text>
      </View>
    </View>
  );
}

function SuggestionCard({
  s,
  decision,
  sourceLabels,
  wide,
  onDecide,
}: {
  s: CvSuggestion;
  decision?: SuggestionDecision;
  sourceLabels: string[];
  wide: boolean;
  onDecide: (d: SuggestionDecision | undefined) => void;
}) {
  const { t } = useT();
  const chip =
    decision === 'accepted'
      ? { label: t('prepare.accepted'), icon: 'checkCircleFilled' as const, tone: 'green' as const }
      : decision === 'rejected'
        ? { label: t('prepare.rejected'), icon: 'closeCircle' as const, tone: 'neutral' as const }
        : { label: t('prepare.pending'), icon: 'circle' as const, tone: 'neutral' as const };
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text variant="headline" style={{ flex: 1 }} accessibilityRole="header">
          {s.section}
        </Text>
        <Chip label={chip.label} icon={chip.icon} tone={chip.tone} size="sm" />
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 10 }}>
        <Pane label={t('prepare.before')} text={s.before} />
        <Pane label={t('prepare.after')} text={s.after} suggested />
      </View>
      <View style={{ gap: 4 }}>
        <Text variant="footnote" color="secondaryLabel" weight="600">
          {t('prepare.why')}
        </Text>
        <Text variant="subheadline" color="secondaryLabel">
          {s.reason}
        </Text>
      </View>
      {s.unverified ? <UnverifiedNote>{s.kind === 'skill_add' ? t('assistant.unverifiedSkill') : t('assistant.unverifiedResult')}</UnverifiedNote> : null}
      {sourceLabels.length ? <SourceNote sources={sourceLabels} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          title={t('common.reject')}
          icon="close"
          size="medium"
          variant={decision === 'rejected' ? 'filled' : 'gray'}
          style={{ flex: 1 }}
          haptic="none"
          accessibilityState={{ selected: decision === 'rejected' }}
          onPress={() => {
            haptics.select();
            onDecide(decision === 'rejected' ? undefined : 'rejected');
          }}
        />
        <Button
          title={t('common.accept')}
          icon="check"
          size="medium"
          variant={decision === 'accepted' ? 'filled' : 'tinted'}
          style={{ flex: 1 }}
          haptic="none"
          accessibilityState={{ selected: decision === 'accepted' }}
          onPress={() => {
            if (decision === 'accepted') haptics.select();
            else if (s.unverified) haptics.warning();
            else haptics.success();
            onDecide(decision === 'accepted' ? undefined : 'accepted');
          }}
        />
      </View>
    </Card>
  );
}

export default function CvOptimizerScreen() {
  const params = useLocalSearchParams<{ jobId?: string; auto?: string }>();
  const { t } = useT();
  const { online } = useNetwork();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 500;

  const cv = profile.use((s) => s.cv);
  const jobs = data.use((s) => s.jobs);
  const drafts = assistant.use((s) => s.drafts);
  const items = useMemo(() => confirmedItems(cv?.items), [cv]);

  const [jobId, setJobId] = useState<string | null>(params.jobId && jobs[params.jobId] ? params.jobId : null);
  const job = jobId ? jobs[jobId] : undefined;
  const [stage, setStage] = useState<Stage>('idle');
  const [workStep, setWorkStep] = useState(0);
  const [suggestions, setSuggestions] = useState<CvSuggestion[]>([]);
  const [decisions, setDecisions] = useState<Record<string, SuggestionDecision>>({});
  const [saved, setSaved] = useState<{ text: string } | null>(null);

  useEffect(() => {
    void ensureAssistantHydrated();
  }, []);

  // Opened from a finished assistant task: show the result straight away.
  const auto = useRef(false);
  useEffect(() => {
    if (params.auto === '1' && !auto.current && items.length) {
      auto.current = true;
      setSuggestions(suggestCvChanges(items, params.jobId ? jobs[params.jobId] : undefined));
      setStage('ready');
    }
  }, [params.auto, params.jobId, items, jobs]);

  // Real step progress while "analysing".
  const stepKeys = useMemo(() => (job ? (['read_cv', 'read_job', 'draft_cv'] as const) : (['read_cv', 'draft_cv'] as const)), [job]);
  useEffect(() => {
    if (stage !== 'working') return;
    let i = 0;
    let cancelled = false;
    setWorkStep(0);
    const h = setInterval(() => {
      if (cancelled) return;
      i += 1;
      if (i >= stepKeys.length) {
        clearInterval(h);
        setSuggestions(suggestCvChanges(items, job));
        setDecisions({});
        setSaved(null);
        setStage('ready');
        haptics.success();
      } else {
        setWorkStep(i);
      }
    }, 800);
    return () => {
      cancelled = true;
      clearInterval(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function chooseJob(id: string | null) {
    setJobId(id);
    setStage('idle');
    setSuggestions([]);
    setDecisions({});
    setSaved(null);
  }

  const accepted = suggestions.filter((s) => decisions[s.id] === 'accepted');
  const rejected = suggestions.filter((s) => decisions[s.id] === 'rejected').length;
  const pending = suggestions.length - accepted.length - rejected;

  function labelsFor(s: CvSuggestion): string[] {
    const names = s.cvItemIds
      .map((id) => items.find((i) => i.id === id)?.label)
      .filter(Boolean)
      .slice(0, 4) as string[];
    const out: string[] = [];
    if (names.length) out.push(`${t('common.yourCv')}: ${names.join(', ')}`);
    if (job && (s.kind === 'summary' || s.kind === 'skills_order' || s.kind === 'skill_add')) out.push(t('common.jobPost'));
    return out;
  }

  function save() {
    const text = renderCvDraft(items, accepted, job);
    saveCvDraft({
      jobId,
      jobLabel: job ? `${job.title} · ${job.company}` : t('assistant.jobGeneral'),
      text,
      acceptedCount: accepted.length,
      unverifiedCount: accepted.filter((a) => a.unverified).length,
    });
    haptics.success();
    setSaved({ text });
  }

  const title = <Stack.Screen options={{ title: t('assistant.toolCv') }} />;

  if (!items.length) {
    return (
      <Screen>
        {title}
        <EmptyState
          icon="document"
          title={t('assistant.noCvTitle')}
          message={t('assistant.noCvBody')}
          actionLabel={t('assistant.reviewCv')}
          onAction={() => router.push('/cv')}
        />
      </Screen>
    );
  }

  const ready = stage === 'ready';
  return (
    <Screen
      footer={
        ready ? (
          <View style={{ gap: 6 }}>
            <Button
              title={saved ? t('assistant.draftSaved') : t('assistant.saveDraft')}
              icon={saved ? 'check' : 'download'}
              disabled={accepted.length === 0 || !!saved}
              onPress={save}
              haptic="none"
            />
            <Text variant="footnote" color="secondaryLabel" align="center">
              {accepted.length === 0 ? t('assistant.saveDraftHint') : t('assistant.saveDraftLocal')}
            </Text>
          </View>
        ) : undefined
      }>
      {title}
      <Padded style={{ marginTop: 12, gap: 8 }}>
        <Text variant="subheadline" color="secondaryLabel">
          {t('assistant.cvIntro')}
        </Text>
      </Padded>

      <Padded style={{ marginTop: 16, gap: 6 }}>
        <Text variant="footnote" color="secondaryLabel" weight="500" style={{ marginHorizontal: 16 }}>
          {t('assistant.chooseJob')}
        </Text>
        <JobPicker value={jobId} onChange={chooseJob} allowGeneral />
      </Padded>

      {stage === 'idle' ? (
        <Padded style={{ marginTop: 16, gap: 6 }}>
          <Button
            title={t('assistant.suggestChanges')}
            icon="wand"
            disabled={!online}
            onPress={() => setStage('working')}
          />
          <OfflineHint />
        </Padded>
      ) : null}

      {stage === 'working' ? (
        <Padded style={{ marginTop: 20 }}>
          <Card style={{ gap: 12 }}>
            <Text variant="headline">{t('assistant.working')}</Text>
            <View accessibilityLiveRegion="polite">
              {stepKeys.map((k, i) => (
                <StepRow
                  key={k}
                  label={t(STEP_LABEL[k])}
                  status={i < workStep ? 'done' : i === workStep ? 'in_progress' : 'waiting'}
                  last={i === stepKeys.length - 1}
                />
              ))}
            </View>
            <Button title={t('common.cancel')} variant="plain" size="medium" onPress={() => setStage('idle')} />
          </Card>
        </Padded>
      ) : null}

      {ready ? (
        <>
          <Padded style={{ marginTop: 20, gap: 10 }}>
            <AiFooter sources={job ? ['cv', 'job'] : ['cv']} />
            {suggestions.length === 0 ? (
              <Text variant="subheadline" color="secondaryLabel">
                {t('assistant.noSuggestions')}
              </Text>
            ) : (
              <Text variant="footnote" color="secondaryLabel" accessibilityLiveRegion="polite">
                {t('assistant.cvSummary', { accepted: accepted.length, rejected, pending })}
              </Text>
            )}
          </Padded>

          <Padded style={{ marginTop: 12, gap: 12 }}>
            {suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                wide={wide}
                decision={decisions[s.id]}
                sourceLabels={labelsFor(s)}
                onDecide={(d) => {
                  setSaved(null);
                  setDecisions((prev) => {
                    const next = { ...prev };
                    if (d) next[s.id] = d;
                    else delete next[s.id];
                    return next;
                  });
                }}
              />
            ))}
          </Padded>

          {saved ? (
            <Padded style={{ marginTop: 16 }}>
              <Card style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Text variant="headline" color="greenText" style={{ flex: 1 }}>
                    {t('assistant.draftSavedTitle')}
                  </Text>
                </View>
                <Text variant="footnote" color="secondaryLabel">
                  {t('assistant.draftSavedBody')}
                </Text>
                <View style={{ backgroundColor: colors.cardNested, borderRadius: radii.md, padding: 12 }}>
                  <Text variant="callout" selectable>
                    {saved.text}
                  </Text>
                </View>
                <CopyButton text={saved.text} />
              </Card>
            </Padded>
          ) : null}
        </>
      ) : null}

      {drafts.length ? (
        <Section header={t('assistant.savedDrafts')} footer={t('assistant.savedDraftsFooter')}>
          {drafts.slice(0, 3).map((d) => (
            <Row
              key={d.id}
              title={d.jobLabel}
              subtitle={`${formatDateTime(d.createdAt)} · ${t('assistant.draftChanges', { count: d.acceptedCount })}`}
              trailing={<CopyButton text={d.text} />}
            />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
