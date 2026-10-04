import { forwardRef, useState, type ReactNode } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { useT } from '@/i18n';
import { MIN_TOUCH, PAGE_MARGIN, radii, useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  trailing?: ReactNode;
  /** Adds a show/hide toggle. */
  password?: boolean;
}

/** Filled iOS text field with an always-visible label (placeholders are not labels). */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, trailing, password, style, multiline, ...rest },
  ref,
) {
  const { colors, typography } = useTheme();
  const { t } = useT();
  const [shown, setShown] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="footnote" color="secondaryLabel" weight="500">
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          minHeight: MIN_TOUCH + 2,
          backgroundColor: colors.card,
          borderRadius: radii.md + 2,
          borderWidth: error ? 1.5 : focused ? 1.5 : 0.5,
          borderColor: error ? colors.red : focused ? colors.accent : colors.separator,
          paddingHorizontal: PAGE_MARGIN - 4,
        }}>
        <TextInput
          ref={ref}
          {...rest}
          multiline={multiline}
          secureTextEntry={password && !shown}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          placeholderTextColor={colors.tertiaryLabel}
          selectionColor={colors.accent}
          allowFontScaling
          maxFontSizeMultiplier={2}
          style={[
            {
              flex: 1,
              fontSize: typography.body.fontSize,
              color: colors.label,
              paddingVertical: multiline ? 12 : 10,
              minHeight: multiline ? 96 : undefined,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            style,
          ]}
        />
        {password ? (
          <Pressable
            onPress={() => setShown((s) => !s)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={shown ? t('auth.hidePassword') : t('auth.showPassword')}
            style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={shown ? 'eyeOff' : 'eye'} size={20} color="secondaryLabel" />
          </Pressable>
        ) : null}
        {trailing}
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} accessibilityLiveRegion="polite">
          <Icon name="alertCircle" size={14} color="red" />
          <Text variant="footnote" color="redText" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="footnote" color="secondaryLabel">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
