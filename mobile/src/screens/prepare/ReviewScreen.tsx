import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { DraftKind } from '@/api/types';
import { AiBadge, SourceNote } from '@/components/domain/Honesty';
import { EmptyState } from '@/components/states';
import { OfflineHint } from '@/components/states/OfflineBanner';
import { Button, Card, Icon, Row, Screen, Section, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { data, requestApproval } from '@/state/data';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';

/** Last look before the approval screen. Nothing is sent from here. */
export default function ReviewScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const { t } = useT();
  const { colors } = useTheme();
  const { online } = useNetwork();
  const run = data.use((s) => s.runs[runId]);
  const job = data.use((s) => (run ? s.jobs[run.jobId] : undefined));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!run || !run.drafts.email) {
    return (
      <Screen>
        <EmptyState icon="document" title={t('prepare.docWaiting')} />
      </Screen>
    );
  }
  const email = run.drafts.email;
  const accepted = run.cvChanges.filter((c) => c.status === 'accepted').length;

  async function next() {
    setBusy(true);
    setError(false);
    try {
      const a = await requestApproval(runId);
      haptics.tap();
      router.push(`/approval/${a.id}`);
    } catch {
      haptics.error();
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const open = (k: DraftKind) => router.push(`/draft/${runId}/${k}`);

  return (
    <Screen
      footer={
        <View style={{ gap: 4 }}>
          <Button title={t('prepare.continueApproval')} onPress={next} loading={busy} disabled={!online} haptic="none" />
          {!online ? <OfflineHint /> : null}
          {error ? (
            <Text variant="footnote" color="redText" align="center" accessibilityRole="alert">
              {t('prepare.approvalError')}
            </Text>
          ) : null}
        </View>
      }>
      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: 4, gap: 10 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('prepare.reviewIntro')}
        </Text>
        {job ? (
          <Text variant="headline">
            {job.title} · {job.company}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radii.md, backgroundColor: colors.greenTint }}>
          <Icon name="shield" size={18} color="greenText" />
          <Text variant="subheadline" color="greenText" weight="600" style={{ flex: 1 }}>
            {t('prepare.reviewNotSent')}
          </Text>
        </View>
      </View>

      <Section header={t('prepare.docEmail')}>
        <View style={{ padding: PAGE_MARGIN, gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <AiBadge />
          </View>
          <Text variant="footnote" color="secondaryLabel">
            {t('prepare.subject')}
          </Text>
          <Text variant="headline">{email.subject}</Text>
          <Text variant="footnote" color="secondaryLabel" style={{ marginTop: 6 }}>
            {t('prepare.body')}
          </Text>
          <Text variant="body">{email.body}</Text>
          <SourceNote sources={email.sources} />
        </View>
        <Row title={t('prepare.openDoc')} icon="envelope" onPress={() => open('email')} />
      </Section>

      <Section header={t('prepare.attachments')}>
        <Row
          title={t('prepare.docCv')}
          subtitle={accepted ? t('prepare.diffSummary', { accepted, rejected: run.cvChanges.filter((c) => c.status === 'rejected').length, pending: run.cvChanges.length - accepted - run.cvChanges.filter((c) => c.status === 'rejected').length }) : undefined}
          icon="document"
          onPress={() => open('cv')}
          trailing={<AiBadge />}
        />
        <Row title={t('prepare.docCover')} icon="document" onPress={() => open('cover_letter')} trailing={<AiBadge />} />
      </Section>
    </Screen>
  );
}
