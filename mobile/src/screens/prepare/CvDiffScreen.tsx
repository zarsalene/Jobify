import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import type { CvChange } from '@/api/types';
import { AiBadge, SourceNote, UnverifiedNote } from '@/components/domain/Honesty';
import { EmptyState } from '@/components/states';
import { Button, Card, Chip, Icon, Screen, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { data, setCvChange } from '@/state/data';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';

function Block({ kind, text }: { kind: 'before' | 'after'; text: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  const after = kind === 'after';
  return (
    <View
      accessible
      accessibilityLabel={`${after ? t('prepare.after') : t('prepare.before')}: ${text}`}
      style={{ padding: 12, borderRadius: radii.md, backgroundColor: after ? colors.accentTint : colors.fill, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={after ? 'plusCircle' : 'minusCircle'} size={14} color={after ? 'accent' : 'secondaryLabel'} />
        <Text variant="caption1" weight="600" color={after ? 'accent' : 'secondaryLabel'} style={{ textTransform: 'uppercase' }}>
          {after ? t('prepare.after') : t('prepare.before')}
        </Text>
      </View>
      <Text variant="subheadline">{text}</Text>
    </View>
  );
}

function ChangeCard({ runId, c }: { runId: string; c: CvChange }) {
  const { t } = useT();
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="headline">{c.section}</Text>
        {c.status === 'accepted' ? (
          <Chip label={t('prepare.accepted')} icon="checkCircleFilled" tone="green" size="sm" />
        ) : c.status === 'rejected' ? (
          <Chip label={t('prepare.rejected')} icon="closeCircle" tone="neutral" size="sm" />
        ) : (
          <Chip label={t('prepare.pending')} icon="circle" size="sm" />
        )}
      </View>
      <Block kind="before" text={c.before} />
      <Block kind="after" text={c.after} />
      <View style={{ gap: 2 }}>
        <Text variant="footnote" color="secondaryLabel" weight="600">
          {t('prepare.why')}
        </Text>
        <Text variant="subheadline">{c.reason}</Text>
      </View>
      {c.unverified ? <UnverifiedNote>{t('prepare.unverifiedChange')}</UnverifiedNote> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          title={t('common.accept')}
          icon="check"
          size="medium"
          fullWidth={false}
          variant={c.status === 'accepted' ? 'filled' : 'tinted'}
          haptic="success"
          style={{ flex: 1 }}
          onPress={() => void setCvChange(runId, c.id, 'accepted')}
        />
        <Button
          title={t('common.reject')}
          icon="close"
          size="medium"
          fullWidth={false}
          variant={c.status === 'rejected' ? 'filled' : 'gray'}
          style={{ flex: 1 }}
          onPress={() => void setCvChange(runId, c.id, 'rejected')}
        />
      </View>
    </Card>
  );
}

/** Diff view of suggested CV changes: accept or reject each one. The original CV is never overwritten. */
export default function CvDiffScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const { t } = useT();
  const run = data.use((s) => s.runs[runId]);
  const changes = run?.cvChanges ?? [];
  const accepted = changes.filter((c) => c.status === 'accepted').length;
  const rejected = changes.filter((c) => c.status === 'rejected').length;
  const pending = changes.length - accepted - rejected;

  return (
    <Screen footer={<Button title={t('common.done')} onPress={() => router.back()} />}>
      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: 4, gap: 10 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('prepare.diffIntro')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <AiBadge />
          <Text variant="footnote" color="secondaryLabel" accessibilityLiveRegion="polite">
            {t('prepare.diffSummary', { accepted, rejected, pending })}
          </Text>
        </View>
        <SourceNote sources={[t('common.yourCv'), t('common.jobPost')]} />
      </View>
      {changes.length === 0 ? (
        <EmptyState icon="swap" title={t('prepare.docWaiting')} />
      ) : (
        <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 16, gap: 12 }}>
          {changes.map((c) => (
            <ChangeCard key={c.id} runId={runId} c={c} />
          ))}
        </View>
      )}
    </Screen>
  );
}
