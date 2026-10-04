import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { Row, Screen, Section, Text } from '@/components/ui';
import { APP_NAME } from '@/constants/app';
import { useT } from '@/i18n';
import { data, pendingApprovals } from '@/state/data';
import { profile } from '@/state/profile';
import { logOut, session } from '@/state/session';
import { PAGE_MARGIN, useTheme } from '@/theme';

function initials(name?: string) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export default function ProfileScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const user = session.use((s) => s.user);
  const cv = profile.use((s) => s.cv);
  const setup = profile.use((s) => s.setup);
  const approvals = data.use((s) => s.approvals);
  const savedCount = data.use((s) => s.savedIds.length);
  const pending = pendingApprovals(approvals).length;
  const confirmed = cv ? cv.items.filter((i) => i.status === 'confirmed').length : 0;

  function confirmLogout() {
    Alert.alert(t('profile.logOutTitle', { app: APP_NAME }), t('profile.logOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logOut'), style: 'destructive', onPress: () => void logOut() },
    ]);
  }

  return (
    <Screen tabs>
      <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, backgroundColor: colors.card }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="title2" color="accent" accessibilityElementsHidden>
            {initials(user?.full_name)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title3" numberOfLines={1}>
            {user?.full_name ?? ''}
          </Text>
          <Text variant="subheadline" color="secondaryLabel" numberOfLines={1}>
            {user?.email ?? ''}
          </Text>
        </View>
      </View>

      <Section header={t('profile.yourProfile')} separatorInset={60}>
        <Row
          title={t('profile.searchPrefs')}
          subtitle={setup?.targetRole ? `${setup.targetRole}${setup.location ? ` · ${setup.location}` : ''}` : t('profile.searchPrefsEmpty')}
          icon="target"
          onPress={() => router.push('/search-preferences')}
        />
        <Row
          title={t('profile.cvSkills')}
          subtitle={cv ? t('profile.cvItems', { confirmed, total: cv.items.length }) : t('profile.cvNone')}
          icon="document"
          iconColor="#5856D6"
          onPress={() => router.push(cv ? '/cv' : '/cv-add')}
        />
        <Row title={t('profile.cvLibrary')} icon="briefcaseUser" iconColor="#AF52DE" onPress={() => router.push('/cv-library')} />
      </Section>

      <Section header={t('profile.activity')} separatorInset={60}>
        <Row title={t('profile.saved')} icon="bookmarkFilled" iconColor="#FF9500" value={String(savedCount)} onPress={() => router.push('/saved')} />
        <Row title={t('profile.approvals')} icon="tray" iconColor="#FF3B30" value={pending ? String(pending) : undefined} onPress={() => router.push('/approvals')} />
        <Row title={t('profile.notifications')} icon="bell" iconColor="#FF2D55" onPress={() => router.push('/notifications')} />
      </Section>

      <Section header={t('profile.tools')} separatorInset={60}>
        <Row title={t('profile.interviewPrep')} icon="mic" iconColor="#34C759" onPress={() => router.push('/interview-prep')} />
        <Row title={t('profile.careerPlan')} icon="trending" iconColor="#30B0C7" onPress={() => router.push('/career-plan')} />
        <Row title={t('profile.salaryInsights')} icon="money" iconColor="#32ADE6" onPress={() => router.push('/salary-insights')} />
      </Section>

      <Section separatorInset={60}>
        <Row title={t('profile.settings')} icon="gear" iconColor="#8E8E93" onPress={() => router.push('/settings')} />
      </Section>

      <Section>
        <Row title={t('profile.logOut')} destructive chevron={false} onPress={confirmLogout} />
      </Section>
    </Screen>
  );
}
