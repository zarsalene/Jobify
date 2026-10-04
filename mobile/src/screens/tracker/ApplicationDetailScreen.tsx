import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { APPLICATION_STATUSES, type ApplicationStatus, type TimelineEvent } from '@/api/types';
import { EmptyState } from '@/components/states';
import { Button, Card, Chip, Icon, MatchChip, Row, Screen, Section, StatusChip, STATUS_META, Text, TextField, type IconName } from '@/components/ui';
import { useT } from '@/i18n';
import { formatDate, formatDateTime } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { data, setApplicationNotes, setApplicationReminder, setApplicationStatus } from '@/state/data';
import { PAGE_MARGIN, useTheme } from '@/theme';

const TL_ICON: Record<TimelineEvent['kind'], IconName> = {
  saved: 'bookmark',
  prepared: 'pencil',
  approved: 'checkCircle',
  sent: 'send',
  status: 'flag',
  note: 'compose',
  reminder: 'calendar',
};

const PRESETS: { days: number; label: 'tracker.reminderIn3' | 'tracker.reminderIn7' | 'tracker.reminderIn14' }[] = [
  { days: 3, label: 'tracker.reminderIn3' },
  { days: 7, label: 'tracker.reminderIn7' },
  { days: 14, label: 'tracker.reminderIn14' },
];

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const { colors } = useTheme();
  const app = data.use((s) => s.applications.find((a) => a.id === id));
  const jobCached = data.use((s) => (app ? !!s.jobs[app.jobId] : false));
  const runId = data.use((s) => (app ? s.runByJob[app.jobId] : undefined));

  const [notes, setNotes] = useState(app?.notes ?? '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [days, setDays] = useState(7);
  const [reminderNote, setReminderNote] = useState('');

  if (!app) {
    return (
      <Screen>
        <EmptyState icon="applications" title={t('tracker.emptyTitle')} actionLabel={t('common.close')} onAction={() => router.back()} />
      </Screen>
    );
  }

  async function saveNotes() {
    if (notes === app!.notes) return;
    await setApplicationNotes(app!.id, notes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 1500);
  }

  const timeline = [...app.timeline].sort((a, b) => +new Date(a.at) - +new Date(b.at));

  return (
    <Screen>
      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: 4, gap: 6 }}>
        <Text variant="title2" accessibilityRole="header">
          {app.jobTitle}
        </Text>
        <Text variant="callout" color="secondaryLabel">
          {app.company} · {app.location}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <StatusChip status={app.status} />
          {app.matchLevel && app.matchScore !== undefined ? <MatchChip level={app.matchLevel} score={app.matchScore} /> : null}
        </View>
      </View>

      <Section header={t('tracker.status')} footer={t('tracker.statusNote')}>
        {APPLICATION_STATUSES.map((s: ApplicationStatus) => (
          <Row
            key={s}
            title={t(STATUS_META[s].labelKey)}
            icon={STATUS_META[s].icon}
            chevron={false}
            trailing={app.status === s ? <Icon name="check" size={18} color="accent" weight="semibold" /> : null}
            onPress={() => {
              if (app.status !== s) {
                haptics.success();
                void setApplicationStatus(app.id, s);
              }
            }}
          />
        ))}
      </Section>

      {jobCached ? (
        <Section>
          <Row title={t('tracker.viewJob')} icon="jobs" onPress={() => router.push(`/job/${app.jobId}`)} />
        </Section>
      ) : null}

      <Section header={t('tracker.timeline')}>
        <View style={{ padding: PAGE_MARGIN, gap: 0 }}>
          {timeline.map((e, i) => (
            <View key={e.id} style={{ flexDirection: 'row', gap: 12 }} accessible accessibilityLabel={`${e.text}, ${formatDateTime(e.at)}`}>
              <View style={{ alignItems: 'center', width: 28 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={TL_ICON[e.kind]} size={14} color="accent" />
                </View>
                {i < timeline.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: colors.fill, marginVertical: 2 }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: i < timeline.length - 1 ? 16 : 0 }}>
                <Text variant="subheadline">{e.text}</Text>
                <Text variant="caption1" color="secondaryLabel">
                  {formatDateTime(e.at)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Section header={t('tracker.documents')}>
        {app.documents.length ? (
          app.documents.map((d) => (
            <Row
              key={d.id}
              title={d.name}
              icon="document"
              onPress={runId ? () => router.push(`/draft/${runId}/${d.kind}`) : undefined}
              chevron={!!runId}
            />
          ))
        ) : (
          <View style={{ padding: PAGE_MARGIN }}>
            <Text variant="subheadline" color="secondaryLabel">
              {t('tracker.noDocuments')}
            </Text>
          </View>
        )}
      </Section>

      <Section header={t('tracker.notes')}>
        <View style={{ padding: 12, gap: 8 }}>
          <TextField
            value={notes}
            onChangeText={setNotes}
            onBlur={saveNotes}
            placeholder={t('tracker.notesPlaceholder')}
            accessibilityLabel={t('tracker.notes')}
            multiline
          />
          {notesSaved ? <Chip label={t('tracker.notesSaved')} icon="check" tone="green" size="sm" /> : null}
        </View>
      </Section>

      <Section header={t('tracker.reminder')} footer={t('tracker.reminderNote')}>
        {app.reminder ? (
          <>
            <Row title={t('tracker.reminderSet', { date: formatDate(app.reminder.dueAt) })} subtitle={app.reminder.note} icon="calendar" chevron={false} />
            <Row title={t('tracker.reminderClear')} destructive chevron={false} onPress={() => void setApplicationReminder(app.id, null)} />
          </>
        ) : (
          <View style={{ padding: 12, gap: 12 }}>
            <Text variant="subheadline" color="secondaryLabel">
              {t('tracker.reminderNone')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {PRESETS.map((p) => (
                <Chip key={p.days} label={t(p.label)} selected={days === p.days} onPress={() => setDays(p.days)} />
              ))}
            </View>
            <TextField value={reminderNote} onChangeText={setReminderNote} placeholder={t('tracker.reminderPlaceholder')} accessibilityLabel={t('tracker.reminderPlaceholder')} />
            <Button
              title={t('tracker.reminderSave')}
              size="medium"
              variant="tinted"
              haptic="success"
              onPress={() =>
                void setApplicationReminder(app.id, {
                  dueAt: new Date(Date.now() + days * 86400_000).toISOString(),
                  note: reminderNote.trim() || undefined,
                })
              }
            />
          </View>
        )}
      </Section>
    </Screen>
  );
}
