import { View } from 'react-native';

import { repo } from '@/api';
import { ErrorState, SkeletonList, UsageLimit } from '@/components/states';
import { ProgressBar, Row, RowBody, Screen, Section, Text } from '@/components/ui';
import { useLoad } from '@/hooks/useLoad';
import { useT } from '@/i18n';
import { formatDate } from '@/lib/format';
import { PAGE_MARGIN } from '@/theme';

function MeterRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const { t } = useT();
  const left = Math.max(0, limit - used);
  return (
    <RowBody>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text variant="body" style={{ flex: 1 }}>
          {label}
        </Text>
        <Text variant="body" color="secondaryLabel">
          {t('settings.usageOf', { used, limit })}
        </Text>
      </View>
      <ProgressBar value={limit ? used / limit : 1} />
      <Text variant="footnote" color="secondaryLabel">
        {left > 0 ? t('settings.usageLeft', { count: left }) : t('settings.usageNone')}
      </Text>
    </RowBody>
  );
}

export default function UsageScreen() {
  const { t } = useT();
  const { data, error, loading, reload } = useLoad(() => repo.usage.get(), []);

  if (loading) {
    return (
      <Screen>
        <SkeletonList count={2} />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ErrorState message={t('settings.usageError')} onRetry={() => void reload()} />
      </Screen>
    );
  }

  const resets = formatDate(data.resetsAt);
  const reached =
    data.aiRuns.used >= data.aiRuns.limit ? { what: t('settings.usageAiRuns'), ...data.aiRuns }
    : data.applications.used >= data.applications.limit ? { what: t('settings.usageApplications'), ...data.applications }
    : null;

  return (
    <Screen onRefresh={reload}>
      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 12 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('settings.usageExplain')}
        </Text>
      </View>

      <Section>
        <Row title={t('settings.usagePlan')} value={data.plan} />
      </Section>

      <Section header={t('settings.usageHeader')} footer={t('settings.usageResets', { date: resets })}>
        <MeterRow label={t('settings.usageAiRuns')} used={data.aiRuns.used} limit={data.aiRuns.limit} />
        <MeterRow label={t('settings.usageApplications')} used={data.applications.used} limit={data.applications.limit} />
      </Section>

      {reached ? (
        <Section>
          <UsageLimit what={reached.what} used={reached.used} limit={reached.limit} resetsOn={resets} />
        </Section>
      ) : (
        <Section header={t('settings.usageDemoHeader')} footer={t('settings.usageDemoFooter')}>
          <UsageLimit what={t('settings.usageDemoWhat')} used={data.aiRuns.limit} limit={data.aiRuns.limit} resetsOn={resets} />
        </Section>
      )}
    </Screen>
  );
}
