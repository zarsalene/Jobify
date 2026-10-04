import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { EmploymentType, MatchLevel, Seniority, WorkMode } from '@/api/types';
import { Button, HeaderButton, Icon, Row, RowBody, Screen, SegmentedControl, Section, TextField } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { activeFilterCount, jobFilters, resetFilters } from '@/state/filters';
import { PAGE_MARGIN } from '@/theme';

const MODES: WorkMode[] = ['remote', 'hybrid', 'onsite'];
const TYPES: EmploymentType[] = ['full_time', 'part_time', 'contract', 'internship'];
const LEVELS: Seniority[] = ['intern', 'junior', 'mid', 'senior', 'lead'];
const MATCH: (MatchLevel | undefined)[] = [undefined, 'partial', 'good', 'strong'];

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** Filter bottom sheet. Changes apply live to the list behind it. */
export default function FiltersScreen() {
  const { t } = useT();
  const f = jobFilters.use((s) => s);
  const [salary, setSalary] = useState(f.salaryMin ? String(f.salaryMin) : '');
  const check = (on: boolean) => (on ? <Icon name="check" size={18} color="accent" weight="semibold" /> : null);

  return (
    <Screen
      footer={<Button title={t('jobs.filterApply')} onPress={() => router.back()} />}
      contentStyle={{ paddingTop: 8 }}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <HeaderButton text={t('jobs.filterReset')} label={t('jobs.filterReset')} onPress={() => { resetFilters(); setSalary(''); }} disabled={activeFilterCount(f) === 0} />
          ),
          headerRight: () => <HeaderButton text={t('common.done')} label={t('common.done')} bold onPress={() => router.back()} />,
        }}
      />

      <Section header={t('jobs.filterSort')}>
        <RowBody>
          <SegmentedControl
            accessibilityLabel={t('jobs.filterSort')}
            value={f.sort}
            onChange={(v) => jobFilters.set({ sort: v })}
            options={[
              { value: 'best_match', label: t('jobs.sortBest') },
              { value: 'newest', label: t('jobs.sortNewest') },
            ]}
          />
        </RowBody>
      </Section>

      <Section header={t('jobs.filterWorkMode')}>
        {MODES.map((m) => (
          <Row key={m} title={t(`jobs.workmode_${m}` as TKey)} chevron={false} trailing={check(f.workModes.includes(m))} onPress={() => jobFilters.set({ workModes: toggle(f.workModes, m) })} />
        ))}
      </Section>

      <Section header={t('jobs.filterType')}>
        {TYPES.map((m) => (
          <Row key={m} title={t(`jobs.type_${m}` as TKey)} chevron={false} trailing={check(f.employmentTypes.includes(m))} onPress={() => jobFilters.set({ employmentTypes: toggle(f.employmentTypes, m) })} />
        ))}
      </Section>

      <Section header={t('jobs.filterSeniority')}>
        {LEVELS.map((m) => (
          <Row key={m} title={t(`jobs.level_${m}` as TKey)} chevron={false} trailing={check(f.seniority.includes(m))} onPress={() => jobFilters.set({ seniority: toggle(f.seniority, m) })} />
        ))}
      </Section>

      <Section header={t('jobs.filterMatch')}>
        {MATCH.map((m) => (
          <Row
            key={m ?? 'any'}
            title={m ? t(`jobs.level${m[0].toUpperCase()}${m.slice(1)}` as TKey) : t('jobs.filterMatchAny')}
            chevron={false}
            trailing={check(f.minLevel === m)}
            onPress={() => jobFilters.set({ minLevel: m })}
          />
        ))}
      </Section>

      <View style={{ paddingHorizontal: PAGE_MARGIN, marginTop: 24, gap: 6 }}>
        <TextField
          label={t('jobs.filterSalary')}
          value={salary}
          onChangeText={(v) => {
            setSalary(v);
            const n = parseInt(v.replace(/[^\d]/g, ''), 10);
            jobFilters.set({ salaryMin: Number.isFinite(n) && n > 0 ? n : undefined });
          }}
          keyboardType="number-pad"
          hint={t('jobs.filterSalaryNote')}
        />
      </View>
    </Screen>
  );
}
