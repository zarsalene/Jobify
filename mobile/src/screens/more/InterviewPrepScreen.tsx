import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import type { Job } from '@/api/types';
import { AiBadge, SourceNote } from '@/components/domain/Honesty';
import { CheckRow } from '@/components/settings/CheckRow';
import { EmptyState } from '@/components/states';
import { Chip, Row, Screen, Section, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { data } from '@/state/data';
import { profile } from '@/state/profile';
import { PAGE_MARGIN } from '@/theme';

const MAX_SKILL_QUESTIONS = 4;

export default function InterviewPrepScreen() {
  const { t } = useT();
  const jobs = data.use((s) => s.jobs);
  const savedIds = data.use((s) => s.savedIds);
  const applications = data.use((s) => s.applications);
  const cv = profile.use((s) => s.cv);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const candidates = useMemo(() => {
    const ids = new Set<string>([...savedIds, ...applications.map((a) => a.jobId)]);
    return [...ids].map((id) => jobs[id]).filter((j): j is Job => !!j);
  }, [jobs, savedIds, applications]);

  const cvSkills = useMemo(
    () => new Set((cv?.items ?? []).filter((i) => i.section === 'skills').map((i) => i.label.trim().toLowerCase())),
    [cv],
  );

  const job = candidates.find((j) => j.id === selectedId) ?? candidates[0];

  if (!job) {
    return (
      <Screen>
        <EmptyState
          icon="mic"
          title={t('extras.interviewEmptyTitle')}
          message={t('extras.interviewEmptyBody')}
          actionLabel={t('extras.interviewEmptyAction')}
          onAction={() => router.navigate('/jobs')}
        />
      </Screen>
    );
  }

  const skills = job.skills.slice(0, MAX_SKILL_QUESTIONS);
  const sources = [t('extras.interviewSources'), ...(cv ? [t('extras.interviewSourcesCv')] : [])];

  return (
    <Screen>
      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 12 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('extras.interviewIntro')}
        </Text>
      </View>

      <Section header={t('extras.interviewPickHeader')}>
        {candidates.map((j) => (
          <CheckRow key={j.id} title={j.title} subtitle={j.company} selected={j.id === job.id} onPress={() => setSelectedId(j.id)} />
        ))}
      </Section>

      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 20, gap: 8 }}>
        <AiBadge />
        <SourceNote sources={sources} />
        <Text variant="footnote" color="secondaryLabel">
          {t('extras.interviewTemplateNote')}
        </Text>
      </View>

      <Section header={t('extras.interviewCatAbout')}>
        <Row title={t('extras.interviewQAbout1', { title: job.title, company: job.company })} />
        <Row title={t('extras.interviewQAbout2')} />
      </Section>

      {skills.length > 0 ? (
        <Section header={t('extras.interviewCatSkills')}>
          {skills.map((s) => (
            <Row key={s} title={t('extras.interviewQSkill', { skill: s })} />
          ))}
        </Section>
      ) : null}

      <Section header={t('extras.interviewCatBehavioural')}>
        <Row title={t('extras.interviewQBeh1')} />
        <Row title={t('extras.interviewQBeh2')} />
        <Row title={t('extras.interviewQBeh3')} />
      </Section>

      <Section header={t('extras.interviewCatAsk')}>
        <Row title={t('extras.interviewQAsk1')} />
        <Row title={t('extras.interviewQAsk2')} />
        <Row title={t('extras.interviewQAsk3')} />
      </Section>

      {job.skills.length > 0 ? (
        <Section header={t('extras.interviewSkillsHeader')} footer={t('extras.interviewSkillsFooter')}>
          {job.skills.map((s) => {
            const onCv = cvSkills.has(s.trim().toLowerCase());
            return (
              <Row
                key={s}
                title={s}
                trailing={
                  <Chip
                    label={onCv ? t('extras.interviewSkillOnCv') : t('extras.interviewSkillNotOnCv')}
                    icon={onCv ? 'checkCircle' : 'minusCircle'}
                    tone={onCv ? 'green' : 'neutral'}
                    size="sm"
                  />
                }
              />
            );
          })}
        </Section>
      ) : null}

      <Section header={t('extras.interviewTipsHeader')} separatorInset={57}>
        <Row icon="info" title={t('extras.interviewTip1')} />
        <Row icon="info" title={t('extras.interviewTip2')} />
        <Row icon="info" title={t('extras.interviewTip3')} />
        <Row icon="info" title={t('extras.interviewTip4')} />
      </Section>
    </Screen>
  );
}
