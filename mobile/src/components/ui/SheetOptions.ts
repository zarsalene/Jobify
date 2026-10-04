import type { NativeStackNavigationOptions } from 'expo-router';
import { Platform } from 'react-native';

/** Options for a bottom sheet with a grabber (iOS formSheet; modal elsewhere). */
export function sheetOptions(detents: number[] | 'fitToContents' = [1]): NativeStackNavigationOptions {
  return {
    presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
    sheetGrabberVisible: true,
    sheetAllowedDetents: detents,
    sheetCornerRadius: 24,
    headerLargeTitleEnabled: false,
    headerTransparent: false,
    animation: 'slide_from_bottom',
  };
}
