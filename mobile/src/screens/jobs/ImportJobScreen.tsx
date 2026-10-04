import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ParsingError, type ImportPreview } from '@/api';
import { ParsingProblem } from '@/components/states';
import { OfflineHint } from '@/components/states/OfflineBanner';
import { Button, Card, Chip, HeaderButton, Icon, Screen, Skeleton, Text, TextField } from '@/components/ui';
import { useT } from '@/i18n';
import { formatSalary } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { confirmImport, importJobFromUrl, toggleSave } from '@/state/data';
import { PAGE_MARGIN } from '@/theme';

function Field({ label, value }: { label: string; value?: string }) {
  const { t } = useT();
  return (
    <View style={{ gap: 2 }} accessible accessibilityLabel={`${label}: ${value ?? t('jobs.notFound')}`}>
      <Text variant="footnote" color="secondaryLabel">
        {label}
      </Text>
      {value ? (
        <Text variant="body">{value}</Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Chip label={t('jobs.notFound')} icon="help" tone="orange" size="sm" />
        </View>
      )}
    </View>
  );
}

/** Add a job by pasting its link: paste -> parsed preview -> confirm. Nothing is saved before the user confirms. */
export default function ImportJobScreen() {
  const { t } = useT();
  const { online } = useNetwork();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const [preview, setPreview] = useState<ImportPreview | undefined>();
  const [saving, setSaving] = useState(false);

  async function run() {
    setError(undefined);
    setProblem(undefined);
    setPreview(undefined);
    if (!url.trim()) return;
    setBusy(true);
    try {
      const p = await importJobFromUrl(url);
      setPreview(p);
      haptics.success();
    } catch (e) {
      haptics.error();
      if (e instanceof ParsingError && e.reason === 'invalid_url') setError(t('jobs.invalidUrl'));
      else if (e instanceof ParsingError) setProblem(e.message);
      else setProblem(t('states.parsingBody'));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setSaving(true);
    try {
      const job = await confirmImport(preview);
      await toggleSave(job);
      haptics.success();
      router.replace(`/job/${job.id}`);
    } catch {
      setProblem(t('states.errorSafe'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      footer={
        preview ? (
          <Button title={t('jobs.confirmImport')} onPress={confirm} loading={saving} disabled={!online} haptic="success" />
        ) : (
          <View>
            <Button title={t('jobs.preview')} onPress={run} loading={busy} disabled={!url.trim() || !online} />
            {!online ? <OfflineHint /> : null}
          </View>
        )
      }>
      <Stack.Screen options={{ headerLeft: () => <HeaderButton text={t('common.cancel')} label={t('common.cancel')} onPress={() => router.back()} /> }} />

      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: 8, gap: 16 }}>
        <Text variant="callout" color="secondaryLabel">
          {t('jobs.importSubtitle')}
        </Text>
        <TextField
          label={t('jobs.importLabel')}
          placeholder={t('jobs.importPlaceholder')}
          value={url}
          onChangeText={(v) => {
            setUrl(v);
            setError(undefined);
          }}
          error={error}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={run}
          trailing={
            <Button
              title={t('jobs.paste')}
              variant="plain"
              size="small"
              fullWidth={false}
              onPress={async () => {
                const s = await Clipboard.getStringAsync();
                if (s) setUrl(s.trim());
              }}
            />
          }
        />
      </View>

      <View style={{ paddingHorizontal: PAGE_MARGIN, marginTop: 20, gap: 12 }}>
        {busy ? (
          <Card style={{ gap: 10 }}>
            <Text variant="footnote" color="secondaryLabel">
              {t('jobs.previewing')}
            </Text>
            <Skeleton width="70%" height={18} />
            <Skeleton width="40%" height={14} />
            <Skeleton height={14} />
          </Card>
        ) : null}

        {problem ? <ParsingProblem message={problem} onRetry={run} /> : null}

        {preview ? (
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Icon name="eyeCheck" size={18} color="accent" />
              <Text variant="headline" accessibilityRole="header">
                {t('jobs.previewTitle')}
              </Text>
            </View>
            <Field label={t('jobs.fieldTitle')} value={preview.title} />
            <Field label={t('jobs.fieldCompany')} value={preview.company} />
            <Field label={t('jobs.fieldLocation')} value={preview.location === 'Not found' ? undefined : preview.location} />
            <Field label={t('jobs.fieldSalary')} value={preview.salary ? formatSalary(preview.salary) : undefined} />
            <Chip label={t('jobs.source', { label: preview.job.source.label })} icon="link" size="sm" />
            <Text variant="footnote" color="secondaryLabel">
              {t('jobs.missingNote', { items: preview.missing.join(', ') })}
            </Text>
            <Text variant="footnote" color="orangeText">
              {t('jobs.importSample')}
            </Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
