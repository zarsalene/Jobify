import { Stack } from 'expo-router';

import { sheetOptions } from '@/components/ui/SheetOptions';
import { useStackOptions } from '@/hooks/useStackOptions';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: '(tabs)' };

/** Everything behind sign-in + onboarding. Tabs live in (tabs); the rest push over them. */
export default function AppLayout() {
  const { t } = useT();
  const { colors } = useTheme();
  const base = useStackOptions();
  const large = useStackOptions({ largeTitle: true });
  const sheet = { ...base, ...sheetOptions([1]), contentStyle: { backgroundColor: colors.groupedBackground } };
  const sheetMid = { ...base, ...sheetOptions([0.65, 1]), contentStyle: { backgroundColor: colors.groupedBackground } };

  return (
    <Stack screenOptions={base}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Jobs */}
      <Stack.Screen name="job/[id]" options={{ title: '' }} />
      <Stack.Screen name="job-import" options={{ ...sheetMid, title: t('jobs.importTitle') }} />
      <Stack.Screen name="filters" options={{ ...sheetMid, title: t('jobs.filterTitle') }} />
      <Stack.Screen name="saved" options={{ ...large, title: t('jobs.saved') }} />

      {/* Application preparation */}
      <Stack.Screen name="prepare/[jobId]" options={{ ...large, title: t('prepare.title') }} />
      <Stack.Screen name="draft/[runId]/[kind]" options={{ title: '' }} />
      <Stack.Screen name="cv-diff/[runId]" options={{ title: t('prepare.diffTitle') }} />
      <Stack.Screen name="review/[runId]" options={{ ...large, title: t('prepare.reviewTitle') }} />

      {/* Approvals */}
      <Stack.Screen name="approvals" options={{ ...large, title: t('approvals.title') }} />
      <Stack.Screen name="approval/[id]" options={{ ...sheet, title: '' }} />

      {/* Tracker */}
      <Stack.Screen name="application/[id]" options={{ ...large, title: t('tracker.detailTitle') }} />

      {/* Profile */}
      <Stack.Screen name="cv" options={{ ...large, title: t('cv.reviewTitle') }} />
      <Stack.Screen name="cv-add" options={{ ...base, title: '' }} />
      <Stack.Screen name="search-preferences" options={{ ...base, title: '' }} />

      {/* Notifications + settings */}
      <Stack.Screen name="notifications" options={{ ...large, title: t('home.notifications') }} />
      <Stack.Screen name="notification-settings" options={{ title: t('notifications.settingsTitle') }} />
      <Stack.Screen name="settings/index" options={{ ...large, title: t('settings.title') }} />
      <Stack.Screen name="settings/privacy" options={{ title: t('settings.privacyTitle') }} />
      <Stack.Screen name="settings/language" options={{ title: t('settings.languageTitle') }} />
      <Stack.Screen name="settings/integrations" options={{ title: t('settings.integrationsTitle') }} />
      <Stack.Screen name="settings/data-export" options={{ title: t('settings.exportTitle') }} />
      <Stack.Screen name="settings/delete-account" options={{ title: t('settings.deleteTitle') }} />
      <Stack.Screen name="settings/usage" options={{ title: t('settings.usageTitle') }} />
      <Stack.Screen name="settings/legal" options={{ title: t('settings.legalTitle') }} />
      <Stack.Screen name="settings/sample-tools" options={{ title: t('settings.sampleTitle') }} />

      {/* Assistant tools */}
      <Stack.Screen name="assistant-task/[id]" options={{ title: '' }} />
      <Stack.Screen name="cv-optimizer" options={{ title: '' }} />
      <Stack.Screen name="cover-letter" options={{ title: '' }} />
      <Stack.Screen name="linkedin" options={{ title: '' }} />
      <Stack.Screen name="linkedin-post" options={{ title: '' }} />

      {/* More */}
      <Stack.Screen name="interview-prep" options={{ ...large, title: t('extras.interviewTitle') }} />
      <Stack.Screen name="career-plan" options={{ ...large, title: t('extras.careerTitle') }} />
      <Stack.Screen name="salary-insights" options={{ ...large, title: t('extras.salaryTitle') }} />
      <Stack.Screen name="cv-library" options={{ ...large, title: t('extras.cvLibTitle') }} />
    </Stack>
  );
}
