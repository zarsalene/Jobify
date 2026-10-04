import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { JobCard } from '@/components/domain/JobCard';
import { EmptyState, ErrorState, SkeletonList } from '@/components/states';
import { Icon, HeaderButtonRow, Screen, Text, TextField } from '@/components/ui';
import { useLoad } from '@/hooks/useLoad';
import { useT } from '@/i18n';
import { formatRelative } from '@/lib/format';
import { useNetwork } from '@/lib/network';
import { cachedJobs, data, fetchJobs, toggleSave } from '@/state/data';
import { activeFilterCount, jobFilters, resetFilters, toQuery } from '@/state/filters';
import { PAGE_MARGIN } from '@/theme';

export default function JobsScreen() {
  const { t } = useT();
  const { online } = useNetwork();
  const filters = jobFilters.use((f) => f);
  const savedIds = data.use((s) => s.savedIds);
  const lastSynced = data.use((s) => s.lastSyncedAt);
  const [searchText, setSearchText] = useState(filters.text);

  // Debounce the search box into the shared filter store.
  useEffect(() => {
    const id = setTimeout(() => jobFilters.set({ text: searchText.trim() }), 250);
    return () => clearTimeout(id);
  }, [searchText]);

  const queryKey = JSON.stringify(toQuery(filters));
  const initial = useMemo(() => {
    const c = cachedJobs();
    return c.length ? { items: c, fromCache: true } : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { data: result, error, loading, reload } = useLoad(() => fetchJobs(toQuery(jobFilters.get())), [queryKey, online], initial);

  const count = activeFilterCount(filters);
  const items = result?.items ?? [];
  const showCacheNote = !!result?.fromCache && lastSynced;

  return (
    <Screen tabs onRefresh={reload}>
      <Stack.Screen
        options={{
          headerSearchBarOptions:
            Platform.OS === 'ios'
              ? {
                  placeholder: t('jobs.searchPlaceholder'),
                  hideWhenScrolling: false,
                  onChangeText: (e: { nativeEvent: { text: string } }) => setSearchText(e.nativeEvent.text),
                  onCancelButtonPress: () => setSearchText(''),
                }
              : undefined,
          headerRight: () => (
            <HeaderButtonRow
              buttons={[
                { icon: 'filter', label: count ? t('jobs.filtersActive', { count }) : t('jobs.filters'), badge: count, onPress: () => router.push('/filters') },
                { icon: 'plus', label: t('jobs.addJob'), onPress: () => router.push('/job-import') },
              ]}
            />
          ),
        }}
      />

      {Platform.OS !== 'ios' ? (
        <View style={{ paddingHorizontal: PAGE_MARGIN, paddingTop: 12 }}>
          <TextField
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t('jobs.searchPlaceholder')}
            accessibilityLabel={t('common.search')}
            returnKeyType="search"
            trailing={<Icon name="search" size={18} color="secondaryLabel" />}
          />
        </View>
      ) : null}

      <Text variant="footnote" color="secondaryLabel" style={{ marginHorizontal: PAGE_MARGIN + 4, marginTop: 12 }}>
        {t('jobs.sampleNote')}
        {showCacheNote ? ` ${t('states.cachedNote', { when: formatRelative(lastSynced as string) })}` : ''}
      </Text>

      {loading && !result ? (
        <SkeletonList />
      ) : error && !items.length ? (
        <ErrorState title={t('jobs.loadError')} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="search"
          title={t('jobs.emptyTitle')}
          message={t('jobs.emptyBody')}
          actionLabel={count || searchText ? t('jobs.clearFilters') : undefined}
          onAction={() => {
            resetFilters();
            setSearchText('');
          }}
        />
      ) : (
        <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 12, gap: 12 }}>
          {items.map(({ job, match }) => (
            <JobCard
              key={job.id}
              job={job}
              match={match}
              saved={savedIds.includes(job.id)}
              onPress={() => router.push(`/job/${job.id}`)}
              onToggleSave={() => void toggleSave(job)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
