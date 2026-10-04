import type { NativeStackNavigationOptions } from 'expo-router';
import { Platform } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Shared native-stack options: translucent blurred bar and large collapsing
 * titles on iOS; a plain Material-ish app bar elsewhere.
 */
export function useStackOptions(opts: { largeTitle?: boolean } = {}): NativeStackNavigationOptions {
  const { colors } = useTheme();
  const ios = Platform.OS === 'ios';
  return {
    headerTintColor: colors.accent,
    headerTitleStyle: { color: colors.label },
    headerLargeTitleStyle: { color: colors.label },
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerLargeTitleEnabled: ios && !!opts.largeTitle,
    headerTransparent: ios,
    headerBlurEffect: ios ? 'systemChromeMaterial' : undefined,
    headerStyle: ios ? undefined : { backgroundColor: colors.card },
    contentStyle: { backgroundColor: colors.groupedBackground },
  };
}
