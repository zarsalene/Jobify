import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CvItem, CvSection } from '@/api/types';
import { SourceNote } from '@/components/domain/Honesty';
import { EmptyState } from '@/components/states';
import { Button, Chip, Screen, Text, TextField } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { resetCvParser } from '@/state/cvParser';
import { confirmAllCvItems, deleteCvItem, finishCvStep, profile, updateCvItem } from '@/state/profile';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';

const SECTIONS: { key: CvSection; title: TKey }[] = [
  { key: 'skills', title: 'cv.skills' },
  { key: 'experience', title: 'cv.experience' },
  { key: 'education', title: 'cv.education' },
  { key: 'certifications', title: 'cv.certifications' },
];

const LOW = 0.7;

function ItemCard({ item }: { item: CvItem }) {
  const { t } = useT();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [detail, setDetail] = useState(item.detail ?? '');
  const low = item.confidence < LOW && item.status !== 'confirmed';
  const confirmed = item.status === 'confirmed';

  function confirmDelete() {
    Alert.alert(t('cv.deleteTitle'), t('cv.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          haptics.warning();
          deleteCvItem(item.id);
        },
      },
    ]);
  }

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radii.lg,
        padding: 14,
        gap: 10,
        borderWidth: low ? 1.5 : 0,
        borderColor: colors.orange,
      }}>
      {editing ? (
        <View style={{ gap: 12 }}>
          <TextField label={t('cv.label')} value={label} onChangeText={setLabel} />
          {item.section !== 'skills' ? <TextField label={t('cv.detail')} value={detail} onChangeText={setDetail} multiline /> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title={t('common.save')}
              size="medium"
              fullWidth={false}
              style={{ flex: 1 }}
              onPress={() => {
                updateCvItem(item.id, { label: label.trim() || item.label, detail: detail.trim() || undefined, status: 'confirmed', confidence: 1 });
                setEditing(false);
              }}
            />
            <Button title={t('common.cancel')} variant="gray" size="medium" fullWidth={false} style={{ flex: 1 }} onPress={() => setEditing(false)} />
          </View>
        </View>
      ) : (
        <>
          <View style={{ gap: 4 }}>
            <Text variant="headline">{item.label}</Text>
            {item.detail ? (
              <Text variant="subheadline" color="secondaryLabel">
                {item.detail}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {low ? <Chip label={t('cv.lowConfidence')} icon="warning" tone="orange" size="sm" /> : null}
            {confirmed ? <Chip label={t('cv.confirmed')} icon="checkCircleFilled" tone="green" size="sm" /> : null}
          </View>
          {low ? (
            <Text variant="footnote" color="orangeText">
              {t('cv.lowConfidenceHint')}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {!confirmed ? (
              <Button
                title={t('common.confirm')}
                icon="check"
                size="small"
                fullWidth={false}
                variant="tinted"
                haptic="success"
                onPress={() => updateCvItem(item.id, { status: 'confirmed' })}
              />
            ) : null}
            <Button title={t('common.edit')} icon="pencil" size="small" fullWidth={false} variant="gray" onPress={() => setEditing(true)} />
            <Button title={t('common.delete')} icon="trash" size="small" fullWidth={false} variant="destructive" onPress={confirmDelete} />
          </View>
        </>
      )}
    </View>
  );
}

/** Parsed CV review. `mode="onboarding"` is the last onboarding step; "app" is reachable from Profile and Home. */
export function CvReview({ mode }: { mode: 'onboarding' | 'app' }) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const cv = profile.use((s) => s.cv);
  const pending = cv ? cv.items.filter((i) => i.status !== 'confirmed').length : 0;

  const done = () => {
    haptics.success();
    resetCvParser();
    if (mode === 'onboarding') finishCvStep();
    else router.back();
  };

  if (!cv) {
    return (
      <Screen plain>
        <EmptyState
          icon="document"
          title={t('cv.uploadTitle')}
          message={t('cv.uploadSubtitle')}
          actionLabel={t('cv.choose')}
          onAction={() => router.push(mode === 'onboarding' ? '/cv-upload' : '/cv-add')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: 4 }}>
          <Button title={t('cv.finishReview')} onPress={done} haptic="none" />
          {pending > 0 ? (
            <Text variant="footnote" color="secondaryLabel" align="center">
              {t('cv.remaining', { count: pending })}
            </Text>
          ) : null}
        </View>
      }>
      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: (mode === 'onboarding' ? insets.top : 0) + 24, gap: 8 }}>
        <Text variant="largeTitle" accessibilityRole="header">
          {t('cv.reviewTitle')}
        </Text>
        <Text variant="callout" color="secondaryLabel">
          {t('cv.reviewSubtitle')}
        </Text>
        <SourceNote sources={[cv.fileName]} />
        {cv.isSample ? (
          <Chip label={t('cv.sampleNote')} icon="info" size="sm" tone="orange" />
        ) : null}
        {pending > 0 ? (
          <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <Button title={t('cv.confirmAll')} variant="tinted" size="small" fullWidth={false} haptic="success" onPress={confirmAllCvItems} />
          </View>
        ) : null}
      </View>

      {SECTIONS.map((sec) => {
        const items = cv.items.filter((i) => i.section === sec.key);
        if (!items.length) return null;
        return (
          <View key={sec.key} style={{ marginHorizontal: PAGE_MARGIN, marginTop: 24, gap: 10 }}>
            <Text variant="title3" accessibilityRole="header">
              {t(sec.title)}
            </Text>
            {items.map((i) => (
              <ItemCard key={i.id} item={i} />
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

export default function CvReviewScreen() {
  return <CvReview mode="onboarding" />;
}
