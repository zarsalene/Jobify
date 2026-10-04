import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { planPermission } from '@/api/mock/assistant';
import { PermissionGuide, TaskCard } from '@/components/assistant/TaskCard';
import { taskTitle, ensureAssistantHydrated, assistant, useTask } from '@/state/assistant';
import { EmptyState, SkeletonList } from '@/components/states';
import { Card, Padded, Row, Screen, Section, Text } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { useTheme } from '@/theme';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const hydrated = assistant.use((s) => s.hydrated);
  const task = useTask(id);
  const { colors } = useTheme();

  useEffect(() => {
    void ensureAssistantHydrated();
  }, []);

  if (!task) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('assistant.taskScreenTitle') }} />
        {hydrated ? (
          <EmptyState icon="tray" title={t('assistant.taskMissingTitle')} message={t('assistant.taskMissingBody')} actionLabel={t('common.back')} onAction={() => router.back()} />
        ) : (
          <SkeletonList count={2} />
        )}
      </Screen>
    );
  }

  const level = planPermission(task.plan, task.jobId);
  const levelKey = `approvals.level${level[0].toUpperCase()}${level.slice(1)}` as TKey;

  return (
    <Screen>
      <Stack.Screen options={{ title: taskTitle(task.kind) }} />
      <Padded style={{ marginTop: 12 }}>
        <TaskCard id={task.id} detail />
      </Padded>

      <Section header={t('assistant.detailsHeader')}>
        <Row title={t('assistant.detailCreated')} value={formatDateTime(task.createdAt)} />
        <Row title={t('assistant.detailUpdated')} value={formatDateTime(task.updatedAt)} />
        <Row title={t('assistant.highestPerm')} value={t(levelKey)} />
        {task.approvalId ? (
          <Row title={t('assistant.openApproval')} icon="hand" iconColor={colors.orange}onPress={() => router.push(`/approval/${task.approvalId}`)} />
        ) : null}
      </Section>

      <Padded style={{ marginTop: 20, gap: 8 }}>
        <Card padded style={{ paddingVertical: 4 }}>
          <PermissionGuide />
        </Card>
        <Text variant="footnote" color="secondaryLabel" style={{ marginHorizontal: 16 }}>
          {t('assistant.detailFooter')}
        </Text>
      </Padded>
    </Screen>
  );
}
