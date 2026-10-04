import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import type { Draft, ParsedCv } from '@/api/types';
import { AiBadge, SourceNote, UnverifiedNote } from '@/components/domain/Honesty';
import { EmptyState } from '@/components/states';
import { Chip, Icon, Row, RowBody, Screen, Section, Text } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { formatDate } from '@/lib/format';
import { data } from '@/state/data';
import { profile } from '@/state/profile';
import { PAGE_MARGIN } from '@/theme';

interface Version {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  draft?: Draft;
  sample?: boolean;
}

const SECTION_KEYS: { key: ParsedCv['items'][number]['section']; title: TKey }[] = [
  { key: 'skills', title: 'extras.cvLibSkills' },
  { key: 'experience', title: 'extras.cvLibExperience' },
  { key: 'education', title: 'extras.cvLibEducation' },
  { key: 'certifications', title: 'extras.cvLibCertifications' },
];

function VersionItem({ v, open, onToggle }: { v: Version; open: boolean; onToggle: () => void }) {
  const { t } = useT();
  return (
    <View>
      <Row
        title={v.title}
        subtitle={v.subtitle}
        icon="document"
        onPress={onToggle}
        chevron={false}
        trailing={<Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} color="tertiaryLabel" weight="semibold" />}
        accessibilityHint={open ? t('extras.cvLibCollapse') : t('extras.cvLibExpand')}
      />
      {open ? (
        <RowBody style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {v.draft?.aiAssisted ? <AiBadge /> : null}
            {v.draft?.edited ? <Chip label={t('extras.cvLibEdited')} icon="pencil" size="sm" /> : null}
            {v.sample ? <Chip label={t('extras.cvLibSample')} size="sm" /> : null}
          </View>
          {v.draft?.sources?.length ? <SourceNote sources={v.draft.sources} /> : null}
          {v.draft?.unverifiedNotes?.map((n, i) => (
            <UnverifiedNote key={i}>{n}</UnverifiedNote>
          ))}
          <Text variant="body" selectable>
            {v.body || t('extras.cvLibNoText')}
          </Text>
          <Text variant="footnote" color="secondaryLabel">
            {v.draft ? t('extras.cvLibReadOnly') : `${t('extras.cvLibReadOnly')}. ${t('extras.cvLibParsedNote')}`}
          </Text>
        </RowBody>
      ) : null}
    </View>
  );
}

export default function CvLibraryScreen() {
  const { t, locale } = useT();
  const cv = profile.use((s) => s.cv);
  const runs = data.use((s) => s.runs);
  const jobs = data.use((s) => s.jobs);
  const [openId, setOpenId] = useState<string | null>(null);

  const original = useMemo<Version | null>(() => {
    if (!cv) return null;
    const parts = SECTION_KEYS.map(({ key, title }) => {
      const items = cv.items.filter((i) => i.section === key);
      if (items.length === 0) return '';
      const lines = key === 'skills' ? items.map((i) => i.label).join(', ') : items.map((i) => (i.detail ? `${i.label} - ${i.detail}` : i.label)).join('\n');
      return `${t(title)}\n${lines}`;
    }).filter(Boolean);
    return {
      id: 'original',
      title: cv.fileName,
      subtitle: t('extras.cvLibUploaded', { date: formatDate(cv.parsedAt) }),
      body: parts.join('\n\n'),
      sample: cv.isSample,
    };
  }, [cv, locale]);

  const tailored = useMemo<Version[]>(
    () =>
      Object.values(runs)
        .filter((r) => !!r.drafts.cv)
        .map((r) => ({ run: r, draft: r.drafts.cv as Draft }))
        .sort((a, b) => new Date(b.draft.updatedAt).getTime() - new Date(a.draft.updatedAt).getTime())
        .map(({ run, draft }) => {
          const job = jobs[run.jobId];
          return {
            id: draft.id || run.id,
            title: draft.title,
            subtitle: `${job ? t('extras.cvLibFor', { job: `${job.title}, ${job.company}` }) : t('extras.cvLibForUnknown')} - ${t('extras.cvLibCreated', { date: formatDate(draft.updatedAt) })}`,
            body: draft.body,
            draft,
          };
        }),
    [runs, jobs, locale],
  );

  if (!original && tailored.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="document"
          title={t('extras.cvLibEmptyTitle')}
          message={t('extras.cvLibEmptyBody')}
          actionLabel={t('extras.cvLibEmptyAction')}
          onAction={() => router.push('/cv')}
        />
      </Screen>
    );
  }

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <Screen>
      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 12 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('extras.cvLibIntro')}
        </Text>
      </View>

      {original ? (
        <Section header={t('extras.cvLibOriginalHeader')} separatorInset={57}>
          <VersionItem v={original} open={openId === original.id} onToggle={() => toggle(original.id)} />
        </Section>
      ) : null}

      <Section header={t('extras.cvLibTailoredHeader')} footer={t('extras.cvLibTailoredFooter')} separatorInset={57}>
        {tailored.length > 0 ? (
          tailored.map((v) => <VersionItem key={v.id} v={v} open={openId === v.id} onToggle={() => toggle(v.id)} />)
        ) : (
          <RowBody>
            <Text variant="subheadline" color="secondaryLabel">
              {t('extras.cvLibNoTailored')}
            </Text>
          </RowBody>
        )}
      </Section>
    </Screen>
  );
}
