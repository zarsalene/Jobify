import { BlurView } from 'expo-blur';
import { useState, type ReactNode } from 'react';
import { Platform, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/states/OfflineBanner';
import { ServerWakingUp } from '@/components/states/ServerWakingUp';
import { hairline, PAGE_MARGIN, TAB_BAR_HEIGHT, useTheme } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** The screen sits inside the tab bar - add bottom padding for it. */
  tabs?: boolean;
  /** Pull to refresh. */
  onRefresh?: () => Promise<void> | void;
  /** Sticky bottom bar (e.g. primary action). Blurred like a toolbar. */
  footer?: ReactNode;
  /** Use the plain white background instead of the grouped grey. */
  plain?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Hide the offline/waking banners (e.g. on auth screens that show their own errors). */
  hideBanners?: boolean;
  keyboardAware?: boolean;
}

/**
 * Standard scrolling screen. Works with native large titles on iOS
 * (`contentInsetAdjustmentBehavior="automatic"` makes the title collapse and the
 * blurred bar appear on scroll). Handles safe areas, tab bar clearance,
 * pull-to-refresh and the global offline / server-waking banners.
 */
export function Screen({ children, tabs, onRefresh, footer, plain, contentStyle, hideBanners, keyboardAware = true }: ScreenProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const bottomPad = tabs ? TAB_BAR_HEIGHT + insets.bottom + 24 : footer ? insets.bottom + 120 : insets.bottom + 24;

  return (
    <View style={{ flex: 1, backgroundColor: plain ? colors.background : colors.groupedBackground }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets={keyboardAware}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.secondaryLabel}
              onRefresh={async () => {
                setRefreshing(true);
                try {
                  await onRefresh();
                } finally {
                  setRefreshing(false);
                }
              }}
            />
          ) : undefined
        }
        contentContainerStyle={[{ paddingBottom: bottomPad }, contentStyle]}>
        {hideBanners ? null : (
          <View style={{ marginHorizontal: PAGE_MARGIN, gap: 8, marginTop: 8 }}>
            <ServerWakingUp />
            <OfflineBanner />
          </View>
        )}
        {children}
      </ScrollView>
      {footer ? (
        <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0 }}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={80}
              tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
              style={{ paddingTop: 12, paddingHorizontal: PAGE_MARGIN, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: hairline, borderTopColor: colors.separator }}>
              {footer}
            </BlurView>
          ) : (
            <View style={{ paddingTop: 12, paddingHorizontal: PAGE_MARGIN, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.card, borderTopWidth: hairline, borderTopColor: colors.separator }}>
              {footer}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Content padding used by free-form (non-grouped) blocks inside a Screen. */
export function Padded({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ paddingHorizontal: PAGE_MARGIN }, style]}>{children}</View>;
}
