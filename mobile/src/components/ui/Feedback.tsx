import { useEffect, useState } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { radii, useTheme } from '@/theme';

// ---------------------------------------------------------------------------
// Skeleton - a calm pulse (static when Reduce Motion is on).
// ---------------------------------------------------------------------------

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 6,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduce) {
      opacity.value = 0.7;
      return;
    }
    opacity.value = withRepeat(
      withSequence(withTiming(0.45, { duration: 800, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })),
      -1,
    );
  }, [reduce, opacity]);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.fillSecondary }, anim, style]}
    />
  );
}

// ---------------------------------------------------------------------------
// ProgressBar - determinate (value 0..1) or indeterminate.
// ---------------------------------------------------------------------------

export function ProgressBar({ value, indeterminate, tint }: { value?: number; indeterminate?: boolean; tint?: string }) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (!indeterminate || reduce) return;
    x.value = 0;
    x.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [indeterminate, reduce, x]);
  const seg = w * 0.4;
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: -seg + x.value * (w + seg) }] }));
  const fill = tint ?? colors.accent;
  const pct = Math.max(0, Math.min(1, value ?? 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={indeterminate ? undefined : { min: 0, max: 100, now: Math.round(pct * 100) }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: 4, borderRadius: 2, backgroundColor: colors.fill, overflow: 'hidden' }}>
      {indeterminate ? (
        reduce ? (
          <View style={{ height: 4, width: '40%', marginStart: '30%', backgroundColor: fill, borderRadius: 2 }} />
        ) : (
          <Animated.View style={[{ height: 4, width: seg, backgroundColor: fill, borderRadius: 2 }, anim]} />
        )
      ) : (
        <View style={{ height: 4, width: `${pct * 100}%`, backgroundColor: fill, borderRadius: 2 }} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: colors.card, borderRadius: radii.lg + 2, padding: padded ? 16 : 0, overflow: 'hidden' },
        style,
      ]}>
      {children}
    </View>
  );
}

/** Numeric badge (e.g. approvals count). Always carries a number, never colour alone. */
export function CountBadge({ count }: { count: number }) {
  const { colors } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      accessibilityElementsHidden
      style={{
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 5,
        backgroundColor: colors.red,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Animated.Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', lineHeight: 16 }}>
        {count > 99 ? '99+' : count}
      </Animated.Text>
    </View>
  );
}
