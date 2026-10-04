import { ActivityIndicator, View } from 'react-native';

import type { StepStatus } from '@/api/types';
import { Icon, Text } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import { useTheme } from '@/theme';

const LABEL: Record<StepStatus, TKey> = {
  done: 'prepare.statusDone',
  in_progress: 'prepare.statusInProgress',
  waiting: 'prepare.statusWaiting',
  failed: 'prepare.statusFailed',
};

/** One step of a progress stepper. State is shown as icon + text, never colour alone. */
export function StepRow({
  label,
  status,
  detail,
  last,
}: {
  label: string;
  status: StepStatus;
  detail?: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const statusText = t(LABEL[status]);

  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${statusText}`}
      style={{ flexDirection: 'row', gap: 12, minHeight: 44 }}>
      <View style={{ alignItems: 'center', width: 24 }}>
        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
          {status === 'done' ? (
            <Icon name="checkCircleFilled" size={24} color="greenText" />
          ) : status === 'in_progress' ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : status === 'failed' ? (
            <Icon name="warning" size={22} color="redText" />
          ) : (
            <Icon name="circle" size={22} color="tertiaryLabel" />
          )}
        </View>
        {!last ? <View style={{ flex: 1, width: 2, marginVertical: 4, backgroundColor: status === 'done' ? colors.green : colors.fill, borderRadius: 1 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
        <Text variant="body" weight={status === 'in_progress' ? '600' : '400'} color={status === 'waiting' ? 'secondaryLabel' : 'label'}>
          {label}
        </Text>
        <Text variant="footnote" color={status === 'failed' ? 'redText' : status === 'done' ? 'greenText' : 'secondaryLabel'}>
          {detail ?? statusText}
        </Text>
      </View>
    </View>
  );
}
