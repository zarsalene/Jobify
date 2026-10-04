import { useMemo } from 'react';
import { I18nManager, useColorScheme } from 'react-native';

import { colors, hairline, radii, spacing, typography, type ColorScheme } from './tokens';

/** The one hook screens use for colours, type scale, spacing and radii. */
export function useTheme() {
  const system = useColorScheme();
  const scheme: ColorScheme = system === 'dark' ? 'dark' : 'light';
  return useMemo(
    () => ({
      scheme,
      isDark: scheme === 'dark',
      isRTL: I18nManager.isRTL,
      colors: colors[scheme],
      typography,
      spacing,
      radii,
      hairline,
    }),
    [scheme],
  );
}

export type Theme = ReturnType<typeof useTheme>;
