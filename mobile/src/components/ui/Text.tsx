import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme, type ColorTokens, type FontWeight, type TextVariant } from '@/theme';

export interface TextProps extends RNTextProps {
  /** iOS Dynamic Type style. Default: body. */
  variant?: TextVariant;
  /** A colour token name, or any colour string. Default: label. */
  color?: keyof ColorTokens | (string & {});
  weight?: FontWeight;
  align?: TextStyle['textAlign'];
}

/**
 * The only text primitive. System font (SF Pro on iOS), Dynamic Type sizes,
 * scales with the user's font size setting (allowFontScaling is left on) up to
 * a cap so layouts survive accessibility sizes.
 */
export function Text({
  variant = 'body',
  color = 'label',
  weight,
  align,
  style,
  maxFontSizeMultiplier = 2,
  ...rest
}: TextProps) {
  const { colors, typography } = useTheme();
  const t = typography[variant];
  const resolved = (colors as unknown as Record<string, string>)[color] ?? color;
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        {
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          fontWeight: weight ?? t.fontWeight,
          letterSpacing: t.letterSpacing,
          color: resolved,
          // Keep alignment RTL-aware: 'auto' follows the writing direction of the text.
          textAlign: align ?? 'auto',
        },
        style,
      ]}
    />
  );
}
