import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { SourceKey, Tone } from '@/api/types-assistant';
import { AiBadge, SourceNote } from '@/components/domain/Honesty';
import { Button, Icon, SegmentedControl, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { MIN_TOUCH, radii, hairline, useTheme } from '@/theme';
import { data, fetchJobs } from '@/state/data';

import { useSourceLabels } from './meta';

/** "AI-assisted" label + "Based on: ..." - shown under every piece of AI output. */
export function AiFooter({ sources, extra }: { sources: SourceKey[]; extra?: string[] }) {
  const labels = useSourceLabels();
  return (
    <View style={{ gap: 6, alignItems: 'flex-start' }}>
      <AiBadge />
      <SourceNote sources={[...labels(sources), ...(extra ?? [])]} />
    </View>
  );
}

/** Copy to the clipboard with a visible "Copied" confirmation (text + icon, not colour alone). */
export function CopyButton({ text, size = 'small', variant = 'tinted', fullWidth }: { text: string; size?: 'small' | 'medium'; variant?: 'tinted' | 'gray'; fullWidth?: boolean }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Button
      title={copied ? t('common.copied') : t('common.copy')}
      icon={copied ? 'check' : 'copyDoc'}
      size={size}
      variant={variant}
      fullWidth={fullWidth}
      haptic="none"
      disabled={!text.trim()}
      accessibilityLiveRegion="polite"
      onPress={async () => {
        try {
          await Clipboard.setStringAsync(text);
          haptics.success();
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
          haptics.error();
        }
      }}
    />
  );
}

export function ToneControl({ value, onChange }: { value: Tone; onChange: (t: Tone) => void }) {
  const { t } = useT();
  return (
    <SegmentedControl<Tone>
      accessibilityLabel={t('assistant.tone')}
      value={value}
      onChange={onChange}
      options={[
        { value: 'formal', label: t('assistant.toneFormal') },
        { value: 'friendly', label: t('assistant.toneFriendly') },
        { value: 'concise', label: t('assistant.toneConcise') },
      ]}
    />
  );
}

/**
 * Pick a saved/cached job (or "general"). Reads the offline job cache; fetches the
 * feed once if the cache is empty. `nested` draws on the nested surface when inside a card.
 */
export function JobPicker({
  value,
  onChange,
  allowGeneral,
  nested,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  allowGeneral: boolean;
  nested?: boolean;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const jobs = data.use((s) => s.jobs);
  const savedIds = data.use((s) => s.savedIds);

  const empty = Object.keys(jobs).length === 0;
  useEffect(() => {
    if (empty) void fetchJobs().catch(() => {});
  }, [empty]);

  const list = useMemo(() => {
    const all = Object.values(jobs);
    return [...all.filter((j) => savedIds.includes(j.id)), ...all.filter((j) => !savedIds.includes(j.id))];
  }, [jobs, savedIds]);

  const bg = nested ? colors.cardNested : colors.card;
  type Item = { id: string | null; title: string; subtitle: string };
  const items: Item[] = [
    ...(allowGeneral ? [{ id: null, title: t('assistant.jobGeneral'), subtitle: t('assistant.jobGeneralHint') }] : []),
    ...list.map((j) => ({
      id: j.id as string | null,
      title: j.title,
      subtitle: `${j.company} · ${j.location}${savedIds.includes(j.id) ? ` · ${t('assistant.jobSaved')}` : ''}`,
    })),
  ];

  if (!items.length) {
    return (
      <View style={{ backgroundColor: bg, borderRadius: radii.md + 2, padding: 16, gap: 8 }}>
        <Text variant="subheadline" color="secondaryLabel">
          {t('assistant.noJobs')}
        </Text>
        <Button title={t('assistant.browseJobs')} variant="tinted" size="medium" onPress={() => router.push('/jobs')} />
      </View>
    );
  }

  return (
    <View accessibilityRole="radiogroup" style={{ backgroundColor: bg, borderRadius: radii.md + 2, overflow: 'hidden' }}>
      {items.map((it, i) => {
        const selected = it.id === value;
        return (
          <View key={it.id ?? 'general'}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${it.title}, ${it.subtitle}`}
              onPress={() => {
                haptics.select();
                onChange(it.id);
              }}
              style={({ pressed }) => ({
                minHeight: MIN_TOUCH,
                paddingVertical: 10,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: pressed ? colors.fill : 'transparent',
              })}>
              <View style={{ flex: 1 }}>
                <Text variant="body" numberOfLines={2}>
                  {it.title}
                </Text>
                <Text variant="footnote" color="secondaryLabel" numberOfLines={2}>
                  {it.subtitle}
                </Text>
              </View>
              {selected ? <Icon name="check" size={18} color="accent" weight="semibold" accessibilityLabel={t('assistant.selected')} /> : null}
            </Pressable>
            {i < items.length - 1 ? <View style={{ height: hairline, backgroundColor: colors.separator, marginStart: 16 }} /> : null}
          </View>
        );
      })}
    </View>
  );
}
