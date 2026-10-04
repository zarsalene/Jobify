/**
 * Design tokens. Pure TypeScript - no react-native imports - so the web
 * dashboard can import this file as-is later.
 *
 * Colours follow the iOS system palette (light + dark).
 */

export type ColorScheme = 'light' | 'dark';

export interface ColorTokens {
  /** Interactive accent (systemBlue). */
  accent: string;
  /** Text/icon colour drawn on top of `accent`. */
  onAccent: string;
  /** Accent at low opacity, for tinted buttons and selected rows. */
  accentTint: string;

  /** systemBackground */
  background: string;
  /** systemGroupedBackground - behind inset-grouped lists */
  groupedBackground: string;
  /** secondarySystemGroupedBackground - cards / grouped rows */
  card: string;
  /** tertiarySystemGroupedBackground - nested surfaces inside a card */
  cardNested: string;

  /** tertiarySystemFill */
  fill: string;
  /** secondarySystemFill */
  fillSecondary: string;

  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  quaternaryLabel: string;

  /** separator (translucent hairline) */
  separator: string;
  /** opaqueSeparator */
  opaqueSeparator: string;

  /** Status colours - ONLY for match levels and pipeline status. Always pair with text + icon. */
  green: string;
  orange: string;
  red: string;
  /** Darker/lighter variants that pass AA contrast as text on the tinted chip backgrounds. */
  greenText: string;
  orangeText: string;
  redText: string;
  /** 14-16% tinted chip backgrounds. */
  greenTint: string;
  orangeTint: string;
  redTint: string;

  /** Scrim behind modals. */
  scrim: string;
}

export const colors: Record<ColorScheme, ColorTokens> = {
  light: {
    accent: '#007AFF',
    onAccent: '#FFFFFF',
    accentTint: 'rgba(0,122,255,0.12)',
    background: '#FFFFFF',
    groupedBackground: '#F2F2F7',
    card: '#FFFFFF',
    cardNested: '#F2F2F7',
    fill: 'rgba(118,118,128,0.12)',
    fillSecondary: 'rgba(120,120,128,0.16)',
    label: '#000000',
    secondaryLabel: 'rgba(60,60,67,0.6)',
    tertiaryLabel: 'rgba(60,60,67,0.3)',
    quaternaryLabel: 'rgba(60,60,67,0.18)',
    separator: 'rgba(60,60,67,0.29)',
    opaqueSeparator: '#C6C6C8',
    green: '#34C759',
    orange: '#FF9500',
    red: '#FF3B30',
    greenText: '#1D7A34',
    orangeText: '#A15200',
    redText: '#C2281D',
    greenTint: 'rgba(52,199,89,0.16)',
    orangeTint: 'rgba(255,149,0,0.16)',
    redTint: 'rgba(255,59,48,0.14)',
    scrim: 'rgba(0,0,0,0.4)',
  },
  dark: {
    accent: '#0A84FF',
    onAccent: '#FFFFFF',
    accentTint: 'rgba(10,132,255,0.22)',
    background: '#000000',
    groupedBackground: '#000000',
    card: '#1C1C1E',
    cardNested: '#2C2C2E',
    fill: 'rgba(118,118,128,0.24)',
    fillSecondary: 'rgba(120,120,128,0.32)',
    label: '#FFFFFF',
    secondaryLabel: 'rgba(235,235,245,0.6)',
    tertiaryLabel: 'rgba(235,235,245,0.3)',
    quaternaryLabel: 'rgba(235,235,245,0.18)',
    separator: 'rgba(84,84,88,0.6)',
    opaqueSeparator: '#38383A',
    green: '#30D158',
    orange: '#FF9F0A',
    red: '#FF453A',
    greenText: '#32D74B',
    orangeText: '#FFB340',
    redText: '#FF6961',
    greenTint: 'rgba(48,209,88,0.22)',
    orangeTint: 'rgba(255,159,10,0.22)',
    redTint: 'rgba(255,69,58,0.22)',
    scrim: 'rgba(0,0,0,0.6)',
  },
};

// ---------------------------------------------------------------------------
// Typography - iOS Dynamic Type scale (default "Large" size category).
// System font only: on iOS this resolves to SF Pro, on Android to Roboto.
// ---------------------------------------------------------------------------

export type FontWeight = '400' | '500' | '600' | '700';

export interface TextStyleToken {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
  letterSpacing: number;
}

export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400', letterSpacing: 0.07 },
} as const satisfies Record<string, TextStyleToken>;

export type TextVariant = keyof typeof typography;

// ---------------------------------------------------------------------------
// Spacing - 4pt grid.
// ---------------------------------------------------------------------------

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 44,
  giant: 64,
} as const;

/** Standard horizontal page margin on iPhone. */
export const PAGE_MARGIN = 16;
/** Minimum touch target (Apple HIG). */
export const MIN_TOUCH = 44;
/** Standard primary button height. */
export const BUTTON_HEIGHT = 50;
export const TAB_BAR_HEIGHT = 49;

// ---------------------------------------------------------------------------
// Radii
// ---------------------------------------------------------------------------

export const radii = {
  xs: 6,
  sm: 8,
  /** inset-grouped sections */
  md: 10,
  /** buttons */
  lg: 14,
  xl: 20,
  sheet: 38,
  pill: 999,
} as const;

export const hairline = 0.5;

export const tokens = { colors, typography, spacing, radii };
export type Tokens = typeof tokens;
