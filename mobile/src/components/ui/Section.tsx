import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { hairline, MIN_TOUCH, PAGE_MARGIN, radii, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Section: an inset-grouped list container with hairline separators.
// ---------------------------------------------------------------------------

export interface SectionProps {
  /** Small uppercase-style caption above the group (iOS list header). */
  header?: string;
  /** Footnote under the group. */
  footer?: string;
  children?: ReactNode;
  /** Separator inset from the start edge. 16 normally, 60 when rows have leading icons. */
  separatorInset?: number;
  style?: StyleProp<ViewStyle>;
  /** Remove the side margins (for full-bleed use). */
  flush?: boolean;
}

export function Section({ header, footer, children, separatorInset = PAGE_MARGIN, style, flush }: SectionProps) {
  const { colors } = useTheme();
  const items = Children.toArray(children).filter((c) => isValidElement(c) || typeof c === 'string');
  return (
    <View style={[{ marginTop: 20, marginHorizontal: flush ? 0 : PAGE_MARGIN }, style]}>
      {header ? (
        <Text
          variant="footnote"
          color="secondaryLabel"
          accessibilityRole="header"
          style={{ textTransform: 'uppercase', marginBottom: 6, marginHorizontal: 16 }}>
          {header}
        </Text>
      ) : null}
      <View style={{ backgroundColor: colors.card, borderRadius: radii.md + 2, overflow: 'hidden' }}>
        {items.map((child, i) => (
          <View key={i}>
            {child}
            {i < items.length - 1 ? (
              <View
                style={{
                  height: hairline,
                  backgroundColor: colors.separator,
                  marginStart: separatorInset,
                }}
              />
            ) : null}
          </View>
        ))}
      </View>
      {footer ? (
        <Text variant="footnote" color="secondaryLabel" style={{ marginTop: 6, marginHorizontal: 16 }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

export interface RowProps {
  title: string;
  subtitle?: string;
  /** Right-aligned secondary value. */
  value?: string;
  /** Leading icon in a coloured rounded square (Settings style). */
  icon?: IconName;
  iconColor?: string;
  onPress?: () => void;
  /** Show a chevron. Defaults to true when onPress is set. */
  chevron?: boolean;
  destructive?: boolean;
  /** Switch accessory. */
  switchValue?: boolean;
  onSwitchChange?: (v: boolean) => void;
  /** Custom trailing node. */
  trailing?: ReactNode;
  /** Custom leading node (replaces icon). */
  leading?: ReactNode;
  disabled?: boolean;
  titleLines?: number;
  accessibilityHint?: string;
  testID?: string;
}

export function Row({
  title,
  subtitle,
  value,
  icon,
  iconColor,
  onPress,
  chevron,
  destructive,
  switchValue,
  onSwitchChange,
  trailing,
  leading,
  disabled,
  titleLines,
  accessibilityHint,
  testID,
}: RowProps) {
  const { colors } = useTheme();
  const showChevron = chevron ?? (!!onPress && switchValue === undefined);
  const isSwitch = switchValue !== undefined;

  const content = (
    <View
      style={{
        minHeight: MIN_TOUCH,
        paddingVertical: 10,
        paddingHorizontal: PAGE_MARGIN,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
      {leading ??
        (icon ? (
          <View
            style={{
              width: 29,
              height: 29,
              borderRadius: 7,
              backgroundColor: iconColor ?? colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name={icon} size={17} color="#FFFFFF" weight="medium" />
          </View>
        ) : null)}
      <View style={{ flex: 1 }}>
        <Text
          variant="body"
          color={destructive ? 'red' : disabled ? 'tertiaryLabel' : 'label'}
          numberOfLines={titleLines}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="subheadline" color="secondaryLabel" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" color="secondaryLabel" numberOfLines={1} style={{ maxWidth: '45%' }}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {isSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={(v) => {
            haptics.select();
            onSwitchChange?.(v);
          }}
          disabled={disabled}
          trackColor={{ true: colors.green, false: colors.fillSecondary }}
          accessibilityLabel={title}
        />
      ) : null}
      {showChevron ? <Icon name="chevronRight" size={14} color="tertiaryLabel" weight="semibold" /> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={[title, value, subtitle].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.fill : 'transparent' })}>
      {content}
    </Pressable>
  );
}

/** Free-form content padded like a grouped row. */
export function RowBody({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ padding: PAGE_MARGIN, gap: 8 }, style]}>{children}</View>;
}
