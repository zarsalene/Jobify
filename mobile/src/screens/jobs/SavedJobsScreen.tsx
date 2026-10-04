import { router } from 'expo-router';
import { View } from 'react-native';

import { JobCard } from '@/components/domain/JobCard';
import { EmptyState } from '@/components/states';
import { Screen, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { data, toggleSave } from '@/state/data';
import { PAGE_MARGIN } from '@/theme';

/** Saved jobs. Reads only from the local cache, so it works offline. */
export default function SavedJobsScreen() {
  const { t } = useT();
  const savedIds = data.use((s) => s.savedIds);
  const jobs = data.use((s) => s.jobs);
  const summaries = data.use((s) => s.matchSummaries);
  const list = savedIds.map((id) => jobs[id]).filter(Boolean);

  return (
    <Screen>
      {list.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title={t('jobs.savedEmpty')}
          message={t('jobs.savedEmptyBody')}
          actionLabel={t('tracker.browseJobs')}
          onAction={() => router.replace('/jobs')}
        />
      ) : (
        <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 12, gap: 12 }}>
          <Text variant="footnote" color="secondaryLabel" style={{ marginHorizontal: 4 }}>
            {t('tracker.cached')}
          </Text>
          {list.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              match={summaries[job.id]}
              saved
              onPress={() => router.push(`/job/${job.id}`)}
              onToggleSave={() => void toggleSave(job)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
