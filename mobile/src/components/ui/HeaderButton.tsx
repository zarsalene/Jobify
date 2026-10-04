import { Pressable, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { MIN_TOUCH, useTheme } from '@/theme';

import { CountBadge } from './Feedback';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** Nav bar button: 44pt hit area, optional count badge, or a plain text button. */
export function HeaderButton({
  icon,
  label,
  text,
  onPress,
  badge,
  bold,
  disabled,
}: {
  icon?: IconName;
  /** Accessibility label (required for icon buttons). */
  label: string;
  text?: string;
  onPress: () => void;
  badge?: number;
  bold?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      hitSlop={4}
      style={({ pressed }) => ({
        minWidth: MIN_TOUCH,
        height: MIN_TOUCH,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: text ? 8 : 0,
        opacity: pressed ? 0.5 : disabled ? 0.4 : 1,
      })}>
      {text ? (
        <Text variant="body" color={colors.accent} weight={bold ? '600' : '400'}>
          {text}
        </Text>
      ) : (
        <View>
          <Icon name={icon!} size={22} color="accent" weight="medium" />
          {badge ? (
            <View style={{ position: 'absolute', top: -6, end: -8 }}>
              <CountBadge count={badge} />
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

/** A row of nav bar buttons (for headerRight with more than one action). */
export function HeaderButtonRow({
  buttons,
}: {
  buttons: { icon: IconName; label: string; onPress: () => void; badge?: number }[];
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {buttons.map((b) => (
        <HeaderButton key={b.label} icon={b.icon} label={b.label} onPress={b.onPress} badge={b.badge} />
      ))}
    </View>
  );
}
