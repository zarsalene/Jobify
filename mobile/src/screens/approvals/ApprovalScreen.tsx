import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api';
import type { Approval, SendResult } from '@/api/types';
import { PermissionBadge, SourceNote } from '@/components/domain/Honesty';
import { EmptyState, ErrorState, Success } from '@/components/states';
import { Button, Card, Chip, Icon, Screen, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { formatCountdown, formatDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { approveAndSend, cancelApproval, data, loadApprovals, setApplicationReminder } from '@/state/data';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="footnote" color="secondaryLabel">
        {label}
      </Text>
      {children}
    </View>
  );
}

type Phase = 'review' | 'sending' | 'sent' | 'failed';

/**
 * THE approval screen. Everything that will happen is shown in full, with an
 * expiry countdown, and exactly two buttons: Cancel and Send. Nothing happens
 * until the user taps Send.
 */
export default function ApprovalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const { colors } = useTheme();
  const { online } = useNetwork();
  const approval = data.use((s) => s.approvals.find((a) => a.id === id)) as Approval | undefined;
  const [phase, setPhase] = useState<Phase>('review');
  const [result, setResult] = useState<SendResult | undefined>();
  const [reminderSet, setReminderSet] = useState<string | undefined>();
  useNow(30_000);

  useEffect(() => {
    if (!approval) void loadApprovals().catch(() => {});
  }, [approval]);

  if (!approval) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <EmptyState icon="tray" title={t('approvals.loadError')} actionLabel={t('common.close')} onAction={() => router.back()} />
      </Screen>
    );
  }

  const expired = approval.status === 'expired' || (approval.status === 'pending' && new Date(approval.expiresAt).getTime() < Date.now());
  const closed = approval.status !== 'pending' && phase === 'review';
  const left = formatCountdown(approval.expiresAt);
  const isSend = approval.kind === 'send_application';
  const statusLabel = t(`approvals.status${approval.status[0].toUpperCase()}${approval.status.slice(1)}` as 'approvals.statusSent');

  async function send() {
    haptics.tap();
    setPhase('sending');
    try {
      const r = await approveAndSend(approval!.id);
      setResult(r);
      if (r.ok) {
        haptics.success();
        setPhase('sent');
      } else {
        haptics.error();
        setPhase('failed');
      }
    } catch (e) {
      haptics.error();
      setResult({
        ok: false,
        message: e instanceof ApiError && e.kind === 'offline' ? t('approvals.offlineNote') : t('approvals.failedSafe'),
      });
      setPhase('failed');
    }
  }

  async function cancel() {
    haptics.select();
    if (approval!.status === 'pending') await cancelApproval(approval!.id).catch(() => {});
    router.back();
  }

  async function remind() {
    if (!approval!.applicationId) return;
    const due = new Date(Date.now() + 7 * 86400_000).toISOString();
    await setApplicationReminder(approval!.applicationId, { dueAt: due, note: 'Follow up on your application' }).catch(() => {});
    haptics.success();
    setReminderSet(due);
  }

  // ---------------------------------------------------------------- result states
  if (phase === 'sent') {
    return (
      <Screen footer={<Button title={t('approvals.done')} onPress={() => router.back()} />}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ paddingTop: 24 }}>
          <Success
            title={t('approvals.sentTitle')}
            message={isSend ? t('approvals.sentBody', { to: approval.to ?? '' }) : result?.message}
          />
          {isSend ? <Text variant="footnote" color="secondaryLabel" align="center">{t('approvals.sentNote')}</Text> : null}
        </View>
        {isSend && approval.applicationId ? (
          <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 24 }}>
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Icon name="calendar" size={20} color="accent" />
                <Text variant="headline" style={{ flex: 1 }}>
                  {t('approvals.followTitle')}
                </Text>
              </View>
              <Text variant="subheadline" color="secondaryLabel">
                {reminderSet ? t('approvals.followSet', { date: formatDate(reminderSet) }) : t('approvals.followBody')}
              </Text>
              {!reminderSet ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button title={t('approvals.followYes')} size="medium" variant="tinted" fullWidth={false} style={{ flex: 1 }} onPress={remind} />
                  <Button title={t('approvals.followNo')} size="medium" variant="gray" fullWidth={false} onPress={() => router.back()} />
                </View>
              ) : null}
            </Card>
          </View>
        ) : null}
      </Screen>
    );
  }

  if (phase === 'failed') {
    return (
      <Screen
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={t('common.close')} variant="gray" fullWidth={false} style={{ flex: 1 }} onPress={() => router.back()} />
            <Button title={t('approvals.failedRetry')} fullWidth={false} style={{ flex: 1 }} disabled={!online || expired} onPress={send} />
          </View>
        }>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ paddingTop: 24 }}>
          <ErrorState title={t('approvals.failedTitle')} message={result?.message} safeNote={t('approvals.failedSafe')} />
        </View>
      </Screen>
    );
  }

  // ---------------------------------------------------------------- the approval itself
  const footer =
    closed || expired ? (
      <Button title={t('approvals.done')} onPress={() => router.back()} />
    ) : (
      <View style={{ gap: 6 }}>
        {!online ? (
          <Text variant="footnote" color="secondaryLabel" align="center">
            {t('approvals.offlineNote')}
          </Text>
        ) : null}
        {/* Exactly two buttons. */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title={t('approvals.cancel')} variant="gray" fullWidth={false} style={{ flex: 1 }} disabled={phase === 'sending'} onPress={cancel} haptic="none" />
          <Button title={phase === 'sending' ? t('approvals.sending') : t('approvals.send')} fullWidth={false} style={{ flex: 1 }} loading={phase === 'sending'} disabled={!online} onPress={send} haptic="none" />
        </View>
        <Text variant="caption1" color="secondaryLabel" align="center">
          {t('approvals.cancelNote')}
        </Text>
      </View>
    );

  return (
    <Screen footer={footer} hideBanners={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: 28, gap: 6 }}>
        <Text variant="largeTitle" accessibilityRole="header">
          {approval.title || t('approvals.readyTitle')}
        </Text>
        <Text variant="callout" color="secondaryLabel">
          {t('approvals.readySubtitle')}
        </Text>
      </View>

      {closed ? (
        <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 16 }}>
          <Chip label={t('approvals.handledBanner', { status: statusLabel })} icon="info" tone="neutral" />
        </View>
      ) : (
        <View
          accessible
          accessibilityLiveRegion="polite"
          style={{ marginHorizontal: PAGE_MARGIN, marginTop: 16, padding: 14, borderRadius: radii.lg, backgroundColor: colors.orangeTint, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="clock" size={18} color="orangeText" />
            <Text variant="subheadline" weight="600" color="orangeText">
              {expired ? t('approvals.expired') : t('approvals.expiresIn', { time: left })}
            </Text>
          </View>
          <Text variant="footnote" color="orangeText">
            {t('approvals.onLapseNote', { text: approval.onExpire })}
          </Text>
        </View>
      )}

      <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 16 }}>
        <Card style={{ gap: 14 }}>
          <Field label={t('approvals.action')}>
            <Text variant="headline">{approval.actionName}</Text>
          </Field>
          <Field label={t('approvals.permission')}>
            <PermissionBadge level={approval.permission} explain />
          </Field>
          {approval.to ? (
            <Field label={t('approvals.to')}>
              <Text variant="body">{approval.to}</Text>
            </Field>
          ) : null}
          {approval.subject ? (
            <Field label={t('approvals.subject')}>
              <Text variant="body">{approval.subject}</Text>
            </Field>
          ) : null}
        </Card>
      </View>

      <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 12 }}>
        <Card style={{ gap: 8 }}>
          <Text variant="footnote" color="secondaryLabel">
            {t('approvals.message')}
          </Text>
          <Text variant="body" selectable>
            {approval.body}
          </Text>
        </Card>
      </View>

      {approval.attachments.length ? (
        <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 12 }}>
          <Card style={{ gap: 10 }}>
            <Text variant="footnote" color="secondaryLabel">
              {t('approvals.attachments')}
            </Text>
            {approval.attachments.map((a) => (
              <View key={a.name} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Icon name="document" size={18} color="accent" />
                <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                  {a.name}
                </Text>
                {a.sizeKb ? (
                  <Text variant="footnote" color="secondaryLabel">
                    {a.sizeKb} KB
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <View style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 14 }}>
        <SourceNote sources={approval.sources} />
      </View>
    </Screen>
  );
}
