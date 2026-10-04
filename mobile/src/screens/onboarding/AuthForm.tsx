import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { PAGE_MARGIN } from '@/theme';

/** Shared layout for sign up / log in / forgot password. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Screen plain>
      <View style={{ paddingHorizontal: PAGE_MARGIN + 4, paddingTop: 8, gap: 8 }}>
        <Text variant="largeTitle" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="callout" color="secondaryLabel">
            {subtitle}
          </Text>
        ) : null}
        <View style={{ marginTop: 16, gap: 16 }}>{children}</View>
      </View>
    </Screen>
  );
}

/** Inline error panel (announced to screen readers). */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Text variant="subheadline" color="redText">
        {message}
      </Text>
    </View>
  );
}
