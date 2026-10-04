import { View } from 'react-native';

import { Chip, Text, Icon } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { radii, useTheme } from '@/theme';
import type { PermissionLevel } from '@/api/types';

/** Marks AI-produced content. Always text + icon. */
export function AiBadge() {
  const { t } = useT();
  return <Chip label={t('common.aiAssisted')} icon="sparkle" tone="accent" size="sm" />;
}

/** "Based on: your CV, job post" - shown wherever AI output appears. */
export function SourceNote({ sources }: { sources: string[] }) {
  const { t } = useT();
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
      <Icon name="info" size={14} color="secondaryLabel" />
      <Text variant="footnote" color="secondaryLabel" style={{ flex: 1 }}>
        {t('common.basedOn', { sources: sources.join(', ') })}
      </Text>
    </View>
  );
}

/** Warning for anything the AI could not tie to the CV or the post. */
export function UnverifiedNote({ children }: { children: string }) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View
      accessible
      style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: radii.md, backgroundColor: colors.orangeTint, alignItems: 'flex-start' }}>
      <Icon name="warning" size={16} color="orangeText" />
      <View style={{ flex: 1 }}>
        <Text variant="footnote" color="orangeText" weight="600">
          {t('common.unverified')}
        </Text>
        <Text variant="footnote" color="orangeText">
          {children}
        </Text>
      </View>
    </View>
  );
}

const LEVEL_META: Record<PermissionLevel, { name: TKey; body: TKey; tone: 'neutral' | 'accent' | 'orange' | 'red'; icon: 'eye' | 'pencil' | 'megaphone' | 'trash' }> = {
  read: { name: 'approvals.levelRead', body: 'approvals.levelReadBody', tone: 'neutral', icon: 'eye' },
  write: { name: 'approvals.levelWrite', body: 'approvals.levelWriteBody', tone: 'accent', icon: 'pencil' },
  public: { name: 'approvals.levelPublic', body: 'approvals.levelPublicBody', tone: 'orange', icon: 'megaphone' },
  destructive: { name: 'approvals.levelDestructive', body: 'approvals.levelDestructiveBody', tone: 'red', icon: 'trash' },
};

/** Permission level chip (Read / Write / Public / Destructive). `explain` adds the one-line meaning. */
export function PermissionBadge({ level, explain }: { level: PermissionLevel; explain?: boolean }) {
  const { t } = useT();
  const m = LEVEL_META[level];
  return (
    <View style={{ gap: 6, alignItems: 'flex-start' }}>
      <Chip label={t(m.name)} icon={m.icon} tone={m.tone} size="sm" />
      {explain ? (
        <Text variant="footnote" color="secondaryLabel">
          {t(m.body)}
        </Text>
      ) : null}
    </View>
  );
}
