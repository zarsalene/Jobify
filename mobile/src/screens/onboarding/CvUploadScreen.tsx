import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StepRow } from '@/components/domain/StepRow';
import { ErrorState } from '@/components/states';
import { OfflineHint } from '@/components/states/OfflineBanner';
import { Button, Icon, ProgressBar, Screen, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useNetwork } from '@/lib/network';
import { cvParser, resetCvParser, startCvParse } from '@/state/cvParser';
import { finishCvStep } from '@/state/profile';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';
import type { StepStatus } from '@/api/types';

const MAX_BYTES = 10 * 1024 * 1024;
const MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function CvUpload({ mode }: { mode: 'onboarding' | 'app' }) {
  const { t } = useT();
  const { colors } = useTheme();
  const { online } = useNetwork();
  const insets = useSafeAreaInsets();
  const parser = cvParser.use((s) => s);
  const [problem, setProblem] = useState<string | undefined>();

  // When parsing finishes while this screen is open, go straight to the review.
  useEffect(() => {
    if (parser.status === 'ready') router.replace(mode === 'app' ? '/cv' : '/cv-review');
  }, [parser.status, mode]);

  async function pick() {
    setProblem(undefined);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: MIME, copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.[0]) return;
      const f = res.assets[0];
      const okType = MIME.includes(f.mimeType ?? '') || /\.(pdf|docx)$/i.test(f.name);
      if (!okType) return setProblem(t('cv.wrongType'));
      if (f.size && f.size > MAX_BYTES) return setProblem(t('cv.tooBig'));
      haptics.tap();
      void startCvParse({ name: f.name, size: f.size, uri: f.uri, mimeType: f.mimeType });
    } catch {
      setProblem(t('cv.pickFailed'));
    }
  }

  const busy = parser.status === 'uploading' || parser.status === 'reading';
  const p = parser.progress;
  const stage = (from: number, to: number): StepStatus => (p >= to ? 'done' : p >= from ? 'in_progress' : 'waiting');

  return (
    <Screen
      plain
      footer={
        busy ? (
          <View style={{ gap: 4 }}>
            <Button
              title={t('cv.continueBackground')}
              variant="gray"
              onPress={() => {
                if (mode === 'app') router.back();
                else finishCvStep();
              }}
            />
            <Text variant="footnote" color="secondaryLabel" align="center">
              {t('prepare.backgroundNote')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 4 }}>
            <Button title={parser.status === 'error' ? t('cv.chooseAnother') : t('cv.choose')} icon="upload" onPress={pick} disabled={!online} />
            <OfflineHint />
            {mode === 'onboarding' ? (
              <Button
                title={t('cv.skipCv')}
                variant="plain"
                size="medium"
                onPress={() => {
                  resetCvParser();
                  finishCvStep();
                }}
              />
            ) : null}
          </View>
        )
      }>
      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: (mode === 'onboarding' ? insets.top : 0) + 24, gap: 8 }}>
        <Text variant="largeTitle" accessibilityRole="header">
          {busy ? t('cv.reading') : t('cv.uploadTitle')}
        </Text>
        <Text variant="callout" color="secondaryLabel">
          {busy ? t('cv.readingBody') : t('cv.uploadSubtitle')}
        </Text>
      </View>

      {busy ? (
        <View style={{ marginHorizontal: PAGE_MARGIN, marginTop: 28, padding: 16, borderRadius: radii.lg + 2, backgroundColor: colors.cardNested, gap: 16 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="document" size={22} color="accent" />
            <Text variant="subheadline" numberOfLines={1} style={{ flex: 1 }}>
              {parser.status === 'uploading' ? t('cv.uploading', { name: parser.fileName ?? '' }) : parser.fileName}
            </Text>
          </View>
          <ProgressBar value={p} />
          <View>
            <StepRow label={t('cv.stepUploaded')} status={stage(0, 0.3)} />
            <StepRow label={t('cv.stepExtracting')} status={stage(0.3, 0.5)} />
            <StepRow label={t('cv.stepFinding')} status={stage(0.5, 0.8)} />
            <StepRow label={t('cv.stepPreparing')} status={stage(0.8, 1)} last />
          </View>
        </View>
      ) : parser.status === 'error' ? (
        <ErrorState
          compact
          title={parser.error === 'offline' ? t('states.errorOfflineTitle') : t('cv.pickFailed')}
          message={parser.error === 'offline' ? t('common.offlineExplain') : undefined}
          safeNote={t('states.errorSafe')}
        />
      ) : (
        <View
          style={{
            marginHorizontal: PAGE_MARGIN,
            marginTop: 28,
            padding: 28,
            borderRadius: radii.xl,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.opaqueSeparator,
            alignItems: 'center',
            gap: 10,
          }}>
          <Icon name="upload" size={36} color="accent" weight="light" />
          <Text variant="callout" color="secondaryLabel" align="center">
            {t('cv.formats')}
          </Text>
          {problem ? (
            <Text variant="subheadline" color="redText" align="center" accessibilityRole="alert">
              {problem}
            </Text>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

export default function CvUploadScreen() {
  return <CvUpload mode="onboarding" />;
}
