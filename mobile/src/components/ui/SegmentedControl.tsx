import { useState } from 'react';
import { I18nManager, Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

import { Text } from './Text';

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
}

/** iOS-style segmented control with a sliding thumb. */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  const { colors, isDark } = useTheme();
  const reduce = useReduceMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width ? (width - 4) / options.length : 0;
  const dir = I18nManager.isRTL ? -1 : 1;

  const thumb = useAnimatedStyle(() => {
    const x = dir * index * segment;
    return {
      width: segment,
      transform: [{ translateX: reduce ? withTiming(x, { duration: 0 }) : withSpring(x, { damping: 22, stiffness: 260 }) }],
    };
  }, [index, segment, reduce]);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.fill,
        borderRadius: 9,
        padding: 2,
        minHeight: 36,
      }}>
      {segment > 0 ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 2,
              bottom: 2,
              start: 2,
              borderRadius: 7,
              backgroundColor: isDark ? '#636366' : '#FFFFFF',
              shadowColor: '#000',
              shadowOpacity: isDark ? 0 : 0.12,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            },
            thumb,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => {
              if (!selected) {
                haptics.select();
                onChange(o.value);
              }
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 32, paddingHorizontal: 4 }}>
            <Text variant="footnote" weight={selected ? '600' : '500'} numberOfLines={1} color={selected ? 'label' : 'label'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
