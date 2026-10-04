import { router, Stack, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import type { NotificationType } from '@/state/preferences';
import { EmptyState } from '@/components/states';
import { Button, Chip, Icon, Screen, Text, type IconName } from '@/components/ui';
import { HeaderButton } from '@/components/ui/HeaderButton';
import { useT, type TKey } from '@/i18n';
import { formatRelative } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { markAllRead, markRead, notifications, unreadCount, type AppNotification } from '@/state/notifications';
import { hairline, MIN_TOUCH, PAGE_MARGIN, radii, useTheme } from '@/theme';

const ORDER: NotificationType[] = ['approvals', 'applications', 'matches', 'reminders', 'system'];

const TYPE_META: Record<NotificationType, { title: TKey; icon: IconName }> = {
  approvals: { title: 'notifications.typeApprovals', icon: 'checklist' },
  applications: { title: 'notifications.typeApplications', icon: 'applications' },
  matches: { title: 'notifications.typeMatches', icon: 'target' },
  reminders: { title: 'notifications.typeReminders', icon: 'clock' },
  system: { title: 'notifications.typeSystem', icon: 'info' },
};

function NotificationRow({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const when = formatRelative(item.createdAt);
  const a11y = [item.read ? '' : t('notifications.unreadA11y'), item.title, item.body, when].filter(Boolean).join('. ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={item.route ? t('notifications.openHint') : undefined}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: PAGE_MARGIN,
        alignItems: 'flex-start',
        backgroundColor: pressed ? colors.fill : 'transparent',
      })}>
      <View
        style={{
          width: 29,
          height: 29,
          borderRadius: 7,
          marginTop: 1,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={TYPE_META[item.type].icon} size={17} color="#FFFFFF" weight="medium" />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="body" weight={item.read ? '400' : '700'}>
          {item.title}
        </Text>
        <Text variant="subheadline" color="secondaryLabel">
          {item.body}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
          {item.read ? null : <Chip label={t('notifications.newChip')} tone="accent" size="sm" />}
          <Text variant="caption1" color="secondaryLabel">
            {when}
          </Text>
        </View>
      </View>
      {item.route ? (
        <View style={{ marginTop: 6 }}>
          <Icon name="chevronRight" size={14} color="tertiaryLabel" weight="semibold" />
        </View>
      ) : null}
    </Pressable>
  );
}

function Group({ type, items }: { type: NotificationType; items: AppNotification[] }) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View style={{ marginTop: 20, marginHorizontal: PAGE_MARGIN }}>
      <Text
        variant="footnote"
        color="secondaryLabel"
        accessibilityRole="header"
        style={{ textTransform: 'uppercase', marginBottom: 6, marginHorizontal: 16 }}>
        {t(TYPE_META[type].title)}
      </Text>
      <View style={{ backgroundColor: colors.card, borderRadius: radii.md + 2, overflow: 'hidden' }}>
        {items.map((item, i) => (
          <View key={item.id}>
            <NotificationRow
              item={item}
              onPress={() => {
                haptics.select();
                markRead(item.id);
                if (item.route) router.push(item.route as Href);
              }}
            />
            {i < items.length - 1 ? (
              <View style={{ height: hairline, backgroundColor: colors.separator, marginStart: 57 }} />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const { t } = useT();
  const items = notifications.use((s) => s.items);
  const unread = unreadCount(items);

  const groups = useMemo(
    () =>
      ORDER.map((type) => ({
        type,
        items: items
          .filter((n) => n.type === type)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      })).filter((g) => g.items.length > 0),
    [items],
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderButton icon="gear" label={t('notifications.settingsLink')} onPress={() => router.push('/notification-settings')} />
          ),
        }}
      />

      {items.length === 0 ? (
        <EmptyState icon="bell" title={t('notifications.emptyTitle')} message={t('notifications.emptyBody')} />
      ) : (
        <>
          <View
            style={{
              marginTop: 12,
              marginHorizontal: PAGE_MARGIN + 4,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
            <Text variant="subheadline" color="secondaryLabel" style={{ flex: 1 }} accessibilityLiveRegion="polite">
              {unread > 0 ? t('notifications.unreadCount', { count: unread }) : t('notifications.allRead')}
            </Text>
            <Button
              title={t('notifications.markAllRead')}
              variant="plain"
              size="small"
              disabled={unread === 0}
              haptic="success"
              onPress={markAllRead}
            />
          </View>

          {groups.map((g) => (
            <Group key={g.type} type={g.type} items={g.items} />
          ))}

          <Text variant="footnote" color="secondaryLabel" style={{ marginTop: 20, marginHorizontal: PAGE_MARGIN + 4 }}>
            {t('notifications.sampleNote')}
          </Text>
        </>
      )}
    </Screen>
  );
}
