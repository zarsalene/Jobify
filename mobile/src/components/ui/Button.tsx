import { ActivityIndicator, Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { BUTTON_HEIGHT, MIN_TOUCH, radii, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'filled' | 'tinted' | 'gray' | 'plain' | 'destructive' | 'destructiveFilled';
export type ButtonSize = 'large' | 'medium' | 'small';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  /** Stretch to the container width (default true for large). */
  fullWidth?: boolean;
  haptic?: 'tap' | 'success' | 'warning' | 'none';
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * iOS-style button. Large = 50pt tall, 14pt radius, filled with the accent.
 * All variants keep at least a 44pt touch target.
 */
export function Button({
  title,
  variant = 'filled',
  size = 'large',
  icon,
  loading,
  fullWidth,
  haptic = 'tap',
  disabled,
  onPress,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isDisabled = disabled || loading;
  const height = size === 'large' ? BUTTON_HEIGHT : size === 'medium' ? MIN_TOUCH : 36;

  let bg = 'transparent';
  let fg: string = colors.accent;
  switch (variant) {
    case 'filled':
      bg = colors.accent;
      fg = colors.onAccent;
      break;
    case 'tinted':
      bg = colors.accentTint;
      fg = colors.accent;
      break;
    case 'gray':
      bg = colors.fill;
      fg = colors.accent;
      break;
    case 'destructive':
      bg = 'transparent';
      fg = colors.red;
      break;
    case 'destructiveFilled':
      bg = colors.red;
      fg = '#FFFFFF';
      break;
    case 'plain':
      break;
  }
  if (isDisabled) {
    if (variant === 'filled' || variant === 'destructiveFilled') {
      bg = colors.fillSecondary;
      fg = colors.tertiaryLabel;
    } else {
      fg = colors.tertiaryLabel;
    }
  }

  const stretch = fullWidth ?? size === 'large';

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityLabel={title}
      hitSlop={size === 'small' ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
      disabled={isDisabled}
      onPressIn={() => {
        if (!reduce) scale.value = withSpring(0.97, { damping: 20, stiffness: 400 });
      }}
      onPressOut={() => {
        if (!reduce) scale.value = withSpring(1, { damping: 20, stiffness: 400 });
      }}
      onPress={(e) => {
        if (haptic === 'tap') haptics.tap();
        else if (haptic === 'success') haptics.success();
        else if (haptic === 'warning') haptics.warning();
        onPress?.(e);
      }}
      style={[
        {
          minHeight: height,
          borderRadius: size === 'small' ? radii.md : radii.lg,
          backgroundColor: bg,
          paddingHorizontal: variant === 'plain' || variant === 'destructive' ? 8 : size === 'small' ? 14 : 20,
          alignSelf: stretch ? 'stretch' : 'flex-start',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        },
        animated,
        style,
      ]}
      {...rest}>
      {({ pressed }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 }}>
          {loading ? (
            <ActivityIndicator color={fg} />
          ) : icon ? (
            <Icon name={icon} size={size === 'small' ? 16 : 20} color={fg} weight="medium" />
          ) : null}
          <Text
            variant={size === 'small' ? 'subheadline' : 'headline'}
            color={fg}
            weight="600"
            numberOfLines={2}
            maxFontSizeMultiplier={1.6}
            align="center"
            style={{ flexShrink: 1 }}>
            {title}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}
