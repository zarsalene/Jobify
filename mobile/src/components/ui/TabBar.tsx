import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT, type TKey } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { hairline, TAB_BAR_HEIGHT, useTheme } from '@/theme';

import { CountBadge } from './Feedback';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const TAB_META: Record<string, { label: TKey; icon: IconName; filled: IconName }> = {
  home: { label: 'tabs.home', icon: 'home', filled: 'homeFilled' },
  jobs: { label: 'tabs.jobs', icon: 'jobs', filled: 'jobsFilled' },
  applications: { label: 'tabs.applications', icon: 'applications', filled: 'applicationsFilled' },
  assistant: { label: 'tabs.assistant', icon: 'assistant', filled: 'assistantFilled' },
  profile: { label: 'tabs.profile', icon: 'profile', filled: 'profileFilled' },
};

/**
 * Translucent blurred tab bar (system chrome material on iOS, solid surface on
 * Android). Labels always shown; the selected tab uses the filled symbol.
 */
export function TabBar({ state, navigation, badges }: BottomTabBarProps & { badges?: Record<string, number> }) {
  const { colors, isDark } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();

  const items = (
    <View style={{ flexDirection: 'row', height: TAB_BAR_HEIGHT, alignItems: 'stretch' }}>
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const label = t(meta.label);
        const badge = badges?.[route.name] ?? 0;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={badge ? `${label}, ${badge}` : label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                haptics.select();
                navigation.navigate(route.name, route.params);
              }
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 44 }}>
            <View>
              <Icon name={focused ? meta.filled : meta.icon} size={24} color={focused ? 'accent' : 'secondaryLabel'} />
              {badge ? (
                <View style={{ position: 'absolute', top: -4, end: -10 }}>
                  <CountBadge count={badge} />
                </View>
              ) : null}
            </View>
            <Text
              variant="caption2"
              color={focused ? 'accent' : 'secondaryLabel'}
              weight={focused ? '600' : '500'}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const container = {
    position: 'absolute' as const,
    start: 0,
    end: 0,
    bottom: 0,
    paddingBottom: insets.bottom,
    borderTopWidth: hairline,
    borderTopColor: colors.separator,
  };

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={90} tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} style={container}>
        {items}
      </BlurView>
    );
  }
  return <View style={[container, { backgroundColor: colors.card }]}>{items}</View>;
}
