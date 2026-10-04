import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { MIN_TOUCH, PAGE_MARGIN, useTheme } from '@/theme';

/** "22:00" / "10:00 PM" depending on the language. Input is minutes after midnight. */
export function formatMinutes(total: number, locale: string): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  try {
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}

const MINUTE_STEP = 5;

function Stepper({
  label,
  display,
  onStep,
}: {
  label: string;
  display: string;
  onStep: (dir: 1 | -1) => void;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const button = (dir: 1 | -1) => (
    <Pressable
      onPress={() => {
        haptics.select();
        onStep(dir);
      }}
      accessibilityRole="button"
      accessibilityLabel={t(dir === 1 ? 'notifications.increase' : 'notifications.decrease', { what: label })}
      style={({ pressed }) => ({
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        borderRadius: MIN_TOUCH / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.fillSecondary : colors.fill,
      })}>
      <Icon name={dir === 1 ? 'plus' : 'minus'} size={18} color="accent" weight="semibold" />
    </Pressable>
  );
  return (
    <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
      <Text variant="footnote" color="secondaryLabel">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {button(-1)}
        <Text variant="title2" style={{ minWidth: 40 }} align="center" accessibilityLiveRegion="polite">
          {display}
        </Text>
        {button(1)}
      </View>
    </View>
  );
}

/**
 * A row showing a time that expands into simple hour and minute steppers.
 * No wheel and no native picker, so it works the same everywhere and with a screen reader.
 */
export function TimePickerRow({
  label,
  minutes,
  onChange,
  disabled,
}: {
  label: string;
  /** minutes after midnight, 0..1439 */
  minutes: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
}) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const time = formatMinutes(minutes, locale);

  function stepHour(dir: 1 | -1) {
    onChange((((hour + dir + 24) % 24) * 60) + minute);
  }
  function stepMinute(dir: 1 | -1) {
    onChange(hour * 60 + ((minute + dir * MINUTE_STEP + 60) % 60));
  }

  return (
    <View>
      <Pressable
        onPress={() => {
          haptics.select();
          setOpen((o) => !o);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: !!disabled }}
        accessibilityLabel={t('notifications.timeA11y', { label, time })}
        accessibilityHint={t('notifications.timeEditHint')}
        style={({ pressed }) => ({
          minHeight: MIN_TOUCH,
          paddingVertical: 10,
          paddingHorizontal: PAGE_MARGIN,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: pressed ? colors.fill : 'transparent',
        })}>
        <Text variant="body" color={disabled ? 'tertiaryLabel' : 'label'} style={{ flex: 1 }}>
          {label}
        </Text>
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: open ? colors.accentTint : colors.fill,
          }}>
          <Text variant="body" color={open ? 'accent' : disabled ? 'tertiaryLabel' : 'label'}>
            {time}
          </Text>
        </View>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} color="tertiaryLabel" weight="semibold" />
      </Pressable>
      {open && !disabled ? (
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: PAGE_MARGIN, paddingBottom: 16, paddingTop: 4 }}>
          <Stepper label={t('notifications.hour')} display={String(hour).padStart(2, '0')} onStep={stepHour} />
          <Stepper label={t('notifications.minute')} display={String(minute).padStart(2, '0')} onStep={stepMinute} />
        </View>
      ) : null}
    </View>
  );
}
