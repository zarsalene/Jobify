import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EmploymentType, SearchSetup, Seniority, WorkMode } from '@/api/types';
import { Button, Icon, ProgressBar, Row, Screen, SegmentedControl, Section, Text, TextField } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { PAGE_MARGIN } from '@/theme';

const SENIORITY: Seniority[] = ['intern', 'junior', 'mid', 'senior', 'lead'];
const TYPES: EmploymentType[] = ['full_time', 'part_time', 'contract', 'internship'];
const MODES: WorkMode[] = ['remote', 'hybrid', 'onsite'];

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function emptySetup(): SearchSetup {
  // Currency and period are asked, not assumed; year matches the old placeholder.
  return { targetRole: '', location: '', currency: '', salaryPeriod: 'year', employmentTypes: [], workModes: [] };
}

/**
 * Three-step wizard. Every step is optional; "Skip" is always available and the
 * result can be edited later from Profile. Used in onboarding and Profile.
 */
export function SetupWizard({
  initial,
  onDone,
  onSkip,
  topInset,
}: {
  initial?: SearchSetup;
  onDone: (s: SearchSetup) => void;
  onSkip: () => void;
  topInset?: boolean;
}) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SearchSetup>(initial ?? emptySetup());
  const [salaryText, setSalaryText] = useState(initial?.salaryMin ? String(initial.salaryMin) : '');
  const TOTAL = 3;

  const finish = () => {
    const n = parseInt(salaryText.replace(/[^\d]/g, ''), 10);
    const salaryMin = Number.isFinite(n) && n > 0 ? n : undefined;
    const currency = form.currency.trim().toUpperCase();
    // A minimum without a currency can't be compared honestly, so it isn't kept.
    const keep = salaryMin !== undefined && /^[A-Z]{3}$/.test(currency);
    onDone({
      ...form,
      salaryMin: keep ? salaryMin : undefined,
      currency: keep ? currency : '',
      salaryPeriod: keep ? (form.salaryPeriod ?? 'year') : undefined,
    });
  };

  const check = (on: boolean) => (on ? <Icon name="check" size={18} color="accent" weight="semibold" /> : null);

  return (
    <Screen
      plain={false}
      footer={
        <View style={{ gap: 4 }}>
          <Button
            title={step < TOTAL - 1 ? t('common.continue') : t('setup.finish')}
            onPress={() => (step < TOTAL - 1 ? setStep(step + 1) : finish())}
          />
          {step > 0 ? <Button title={t('common.back')} variant="plain" size="medium" onPress={() => setStep(step - 1)} /> : null}
        </View>
      }>
      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: (topInset ? insets.top : 0) + 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="footnote" color="secondaryLabel">
            {t('setup.step', { current: step + 1, total: TOTAL })}
          </Text>
          <Button title={t('setup.skipSetup')} variant="plain" size="small" fullWidth={false} onPress={onSkip} />
        </View>
        <ProgressBar value={(step + 1) / TOTAL} />
        <Text variant="largeTitle" accessibilityRole="header" style={{ marginTop: 12 }}>
          {t('setup.title')}
        </Text>
        <Text variant="callout" color="secondaryLabel">
          {t('setup.subtitle')}
        </Text>
      </View>

      {step === 0 ? (
        <View style={{ paddingHorizontal: PAGE_MARGIN, marginTop: 24, gap: 16 }}>
          <TextField
            label={t('setup.targetRole')}
            placeholder={t('setup.targetRolePlaceholder')}
            value={form.targetRole}
            onChangeText={(v) => setForm({ ...form, targetRole: v })}
            autoCapitalize="sentences"
            returnKeyType="next"
          />
          <TextField
            label={t('setup.location')}
            placeholder={t('setup.locationPlaceholder')}
            value={form.location}
            onChangeText={(v) => setForm({ ...form, location: v })}
            returnKeyType="done"
          />
        </View>
      ) : null}

      {step === 1 ? (
        <>
          <Section header={t('setup.seniority')}>
            {SENIORITY.map((s) => (
              <Row
                key={s}
                title={t(`setup.${s}` as TKey)}
                onPress={() => setForm({ ...form, seniority: form.seniority === s ? undefined : s })}
                chevron={false}
                trailing={check(form.seniority === s)}
              />
            ))}
          </Section>
          <Section header={t('setup.employmentType')}>
            {TYPES.map((s) => (
              <Row
                key={s}
                title={t(`setup.${s}` as TKey)}
                onPress={() => setForm({ ...form, employmentTypes: toggle(form.employmentTypes, s) })}
                chevron={false}
                trailing={check(form.employmentTypes.includes(s))}
              />
            ))}
          </Section>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Section header={t('setup.workMode')}>
            {MODES.map((s) => (
              <Row
                key={s}
                title={t(`setup.${s}` as TKey)}
                onPress={() => setForm({ ...form, workModes: toggle(form.workModes, s) })}
                chevron={false}
                trailing={check(form.workModes.includes(s))}
              />
            ))}
          </Section>
          <View style={{ paddingHorizontal: PAGE_MARGIN, marginTop: 24 }}>
            <TextField
              label={`${t('setup.salary')} (${t('common.optional')})`}
              placeholder={t('setup.salaryPlaceholder')}
              hint={t('setup.salaryHint')}
              value={salaryText}
              onChangeText={setSalaryText}
              keyboardType="number-pad"
              returnKeyType="done"
            />
            {salaryText.trim() ? (
              <View style={{ gap: 12, marginTop: 12 }}>
                <TextField
                  label={t('setup.currency')}
                  placeholder={t('setup.currencyPlaceholder')}
                  hint={t('setup.currencyHint')}
                  value={form.currency}
                  onChangeText={(v) => setForm({ ...form, currency: v.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() })}
                  autoCapitalize="characters"
                  maxLength={3}
                />
                <SegmentedControl
                  accessibilityLabel={t('setup.period')}
                  options={[
                    { value: 'month', label: t('setup.perMonth') },
                    { value: 'year', label: t('setup.perYear') },
                  ]}
                  value={form.salaryPeriod ?? 'year'}
                  onChange={(v) => setForm({ ...form, salaryPeriod: v })}
                />
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
