import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { MIN_TOUCH, PAGE_MARGIN, useTheme } from '@/theme';

/**
 * Single-choice list row (Language, job picker). The selected row shows a
 * checkmark and exposes the selected state to screen readers.
 */
export function CheckRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        paddingVertical: 10,
        paddingHorizontal: PAGE_MARGIN,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: pressed ? colors.fill : 'transparent',
      })}>
      <View style={{ flex: 1 }}>
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="subheadline" color="secondaryLabel" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ width: 22, alignItems: 'center' }}>
        {selected ? <Icon name="check" size={18} color="accent" weight="semibold" /> : null}
      </View>
    </Pressable>
  );
}
