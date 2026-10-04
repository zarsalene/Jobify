import { useMemo } from 'react';
import { View } from 'react-native';

import type { Job, Salary } from '@/api/types';
import { EmptyState } from '@/components/states';
import { Row, Screen, Section, Text } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { formatDate, formatNumber, formatSalary } from '@/lib/format';
import { data } from '@/state/data';
import { PAGE_MARGIN } from '@/theme';

interface Group {
  key: string;
  currency: string;
  period: Salary['period'];
  jobs: Job[];
  low: number;
  high: number;
  sources: string[];
  latest: string;
}

/** Only ever built from salaries that a job post stated. Nothing is estimated. */
function buildGroups(jobs: Job[]): Group[] {
  const map = new Map<string, Group>();
  jobs.forEach((job) => {
    const s = job.salary;
    if (!s) return;
    const lo = s.min ?? s.max;
    const hi = s.max ?? s.min;
    // Only numeric salaries with a stated currency and period can be grouped and compared.
    if (lo === undefined || hi === undefined || !s.currency || !s.period) return;
    const currency = s.currency;
    const period = s.period;
    const posted = job.postedAt ?? '';
    const key = `${s.currency}|${s.period}`;
    const g = map.get(key);
    if (!g) {
      map.set(key, { key, currency, period, jobs: [job], low: lo, high: hi, sources: [s.source], latest: posted });
    } else {
      g.jobs.push(job);
      g.low = Math.min(g.low, lo);
      g.high = Math.max(g.high, hi);
      if (!g.sources.includes(s.source)) g.sources.push(s.source);
      if (posted && new Date(posted).getTime() > new Date(g.latest || 0).getTime()) g.latest = posted;
    }
  });
  return [...map.values()].sort((a, b) => b.jobs.length - a.jobs.length);
}

export default function SalaryInsightsScreen() {
  const { t } = useT();
  const jobsById = data.use((s) => s.jobs);

  const groups = useMemo(() => buildGroups(Object.values(jobsById)), [jobsById]);
  const ranges = groups.filter((g) => g.jobs.length >= 2);
  const singles = groups.filter((g) => g.jobs.length < 2);

  return (
    <Screen>
      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 12 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('extras.salaryIntro')}
        </Text>
      </View>

      {ranges.length === 0 ? (
        <EmptyState
          compact
          icon="chart"
          title={t('extras.salaryNotEnough')}
          message={t('extras.salaryNotEnoughBody')}
        />
      ) : null}

      {ranges.map((g) => {
        const money = (n: number) => `${g.currency} ${formatNumber(n)}`;
        return (
          <Section
            key={g.key}
            header={t('extras.salaryGroupTitle', {
              currency: g.currency,
              period: t(`extras.salaryPeriod_${g.period}` as TKey),
            })}
            footer={t('extras.salaryGroupFooter', { sources: g.sources.join(', '), date: formatDate(g.latest) })}>
            <Row title={t('extras.salaryLowest')} value={money(g.low)} />
            <Row title={t('extras.salaryHighest')} value={money(g.high)} />
            <Row title={t('extras.salaryPoints')} value={String(g.jobs.length)} />
            <Row title={t('extras.salaryLatest')} value={formatDate(g.latest)} />
          </Section>
        );
      })}

      {singles.length > 0 ? (
        <Section header={t('extras.salarySingleHeader')} footer={t('extras.salarySingleFooter')}>
          {singles.map((g) => {
            const job = g.jobs[0];
            return (
              <Row
                key={g.key}
                title={`${job.title}, ${job.company}`}
                subtitle={`${formatSalary(job.salary!)}\n${t('jobs.salarySource', { source: job.salary!.source })} ${job.postedAt ? ` - ${formatDate(job.postedAt)}` : ''}`}
              />
            );
          })}
        </Section>
      ) : null}

      {groups.length > 0 ? (
        <Text variant="footnote" color="secondaryLabel" style={{ marginTop: 20, marginHorizontal: PAGE_MARGIN + 4 }}>
          {t('extras.salaryDisclaimer')}
        </Text>
      ) : null}
    </Screen>
  );
}
