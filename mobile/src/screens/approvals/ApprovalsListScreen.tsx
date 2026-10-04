import { router } from 'expo-router';
import { useEffect } from 'react';

import type { Approval } from '@/api/types';
import { EmptyState } from '@/components/states';
import { Chip, Row, Screen, Section } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { formatCountdown, formatRelative } from '@/lib/format';
import { data, loadApprovals, pendingApprovals } from '@/state/data';

function ApprovalRow({ a }: { a: Approval }) {
  const { t } = useT();
  const pending = a.status === 'pending' && new Date(a.expiresAt).getTime() > Date.now();
  const key = (pending ? 'Pending' : `${a.status[0].toUpperCase()}${a.status.slice(1)}`) as string;
  return (
    <Row
      title={a.actionName}
      subtitle={[a.to, a.subject].filter(Boolean).join(' · ') || undefined}
      onPress={() => router.push(`/approval/${a.id}`)}
      trailing={
        pending ? (
          <Chip label={t('approvals.expiresShort', { time: formatCountdown(a.expiresAt) })} icon="clock" tone="orange" size="sm" />
        ) : (
          <Chip label={t(`approvals.status${key}` as TKey)} size="sm" icon={a.status === 'sent' ? 'checkCircleFilled' : 'minusCircle'} tone={a.status === 'sent' ? 'green' : 'neutral'} />
        )
      }
      accessibilityHint={formatRelative(a.createdAt)}
    />
  );
}

/** Approvals inbox: everything waiting for a decision, then history. */
export default function ApprovalsListScreen() {
  const { t } = useT();
  const approvals = data.use((s) => s.approvals);
  const pending = pendingApprovals(approvals);
  const past = approvals.filter((a) => !pending.includes(a));

  useEffect(() => {
    void loadApprovals().catch(() => {});
  }, []);

  return (
    <Screen onRefresh={async () => void (await loadApprovals().catch(() => {}))}>
      {approvals.length === 0 ? (
        <EmptyState icon="tray" title={t('approvals.listEmptyTitle')} message={t('approvals.listEmptyBody')} />
      ) : (
        <>
          {pending.length ? (
            <Section header={t('approvals.listPending')}>
              {pending.map((a) => (
                <ApprovalRow key={a.id} a={a} />
              ))}
            </Section>
          ) : null}
          {past.length ? (
            <Section header={t('approvals.listPast')}>
              {past.map((a) => (
                <ApprovalRow key={a.id} a={a} />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}
