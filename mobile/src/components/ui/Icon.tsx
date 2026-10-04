import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { I18nManager, Platform, View, type ColorValue } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { useTheme, type ColorTokens } from '@/theme';

type IonName = ComponentProps<typeof Ionicons>['name'];

interface IconDef {
  /** SF Symbol (iOS). */
  sf: SFSymbol;
  /** Ionicons outline fallback (Android / web). */
  ion: IonName;
}

/**
 * One map for every icon in the app. iOS renders SF Symbols via expo-symbols;
 * Android and web fall back to the Ionicons outline set.
 */
const ICONS = {
  home: { sf: 'house', ion: 'home-outline' },
  homeFilled: { sf: 'house.fill', ion: 'home' },
  jobs: { sf: 'briefcase', ion: 'briefcase-outline' },
  jobsFilled: { sf: 'briefcase.fill', ion: 'briefcase' },
  applications: { sf: 'doc.text', ion: 'document-text-outline' },
  applicationsFilled: { sf: 'doc.text.fill', ion: 'document-text' },
  assistant: { sf: 'sparkles', ion: 'sparkles-outline' },
  assistantFilled: { sf: 'sparkles', ion: 'sparkles' },
  profile: { sf: 'person', ion: 'person-outline' },
  profileFilled: { sf: 'person.fill', ion: 'person' },
  tray: { sf: 'tray', ion: 'file-tray-outline' },
  trayFull: { sf: 'tray.full', ion: 'file-tray-full-outline' },
  bell: { sf: 'bell', ion: 'notifications-outline' },
  bellBadge: { sf: 'bell.badge', ion: 'notifications' },
  plus: { sf: 'plus', ion: 'add' },
  plusCircle: { sf: 'plus.circle', ion: 'add-circle-outline' },
  search: { sf: 'magnifyingglass', ion: 'search-outline' },
  filter: { sf: 'line.3.horizontal.decrease', ion: 'filter-outline' },
  bookmark: { sf: 'bookmark', ion: 'bookmark-outline' },
  bookmarkFilled: { sf: 'bookmark.fill', ion: 'bookmark' },
  chevronRight: { sf: 'chevron.right', ion: 'chevron-forward' },
  chevronLeft: { sf: 'chevron.left', ion: 'chevron-back' },
  chevronDown: { sf: 'chevron.down', ion: 'chevron-down' },
  chevronUp: { sf: 'chevron.up', ion: 'chevron-up' },
  close: { sf: 'xmark', ion: 'close' },
  closeCircle: { sf: 'xmark.circle.fill', ion: 'close-circle' },
  check: { sf: 'checkmark', ion: 'checkmark' },
  checkCircle: { sf: 'checkmark.circle', ion: 'checkmark-circle-outline' },
  checkCircleFilled: { sf: 'checkmark.circle.fill', ion: 'checkmark-circle' },
  circle: { sf: 'circle', ion: 'ellipse-outline' },
  warning: { sf: 'exclamationmark.triangle', ion: 'warning-outline' },
  alertCircle: { sf: 'exclamationmark.circle', ion: 'alert-circle-outline' },
  minusCircle: { sf: 'minus.circle', ion: 'remove-circle-outline' },
  info: { sf: 'info.circle', ion: 'information-circle-outline' },
  help: { sf: 'questionmark.circle', ion: 'help-circle-outline' },
  offline: { sf: 'wifi.slash', ion: 'cloud-offline-outline' },
  clock: { sf: 'clock', ion: 'time-outline' },
  hourglass: { sf: 'hourglass', ion: 'hourglass-outline' },
  link: { sf: 'link', ion: 'link-outline' },
  document: { sf: 'doc.text', ion: 'document-text-outline' },
  copyDoc: { sf: 'doc.on.doc', ion: 'copy-outline' },
  envelope: { sf: 'envelope', ion: 'mail-outline' },
  send: { sf: 'paperplane', ion: 'paper-plane-outline' },
  mapPin: { sf: 'mappin.and.ellipse', ion: 'location-outline' },
  building: { sf: 'building.2', ion: 'business-outline' },
  money: { sf: 'banknote', ion: 'cash-outline' },
  refresh: { sf: 'arrow.clockwise', ion: 'refresh-outline' },
  trash: { sf: 'trash', ion: 'trash-outline' },
  pencil: { sf: 'pencil', ion: 'pencil-outline' },
  compose: { sf: 'square.and.pencil', ion: 'create-outline' },
  gear: { sf: 'gearshape', ion: 'settings-outline' },
  lock: { sf: 'lock', ion: 'lock-closed-outline' },
  shield: { sf: 'checkmark.shield', ion: 'shield-checkmark-outline' },
  hand: { sf: 'hand.raised', ion: 'hand-left-outline' },
  globe: { sf: 'globe', ion: 'globe-outline' },
  moon: { sf: 'moon', ion: 'moon-outline' },
  bolt: { sf: 'bolt', ion: 'flash-outline' },
  star: { sf: 'star', ion: 'star-outline' },
  openExternal: { sf: 'arrow.up.right.square', ion: 'open-outline' },
  ellipsis: { sf: 'ellipsis', ion: 'ellipsis-horizontal' },
  list: { sf: 'list.bullet', ion: 'list-outline' },
  board: { sf: 'rectangle.split.3x1', ion: 'albums-outline' },
  calendar: { sf: 'calendar', ion: 'calendar-outline' },
  chart: { sf: 'chart.bar', ion: 'bar-chart-outline' },
  education: { sf: 'graduationcap', ion: 'school-outline' },
  eye: { sf: 'eye', ion: 'eye-outline' },
  eyeOff: { sf: 'eye.slash', ion: 'eye-off-outline' },
  wand: { sf: 'wand.and.stars', ion: 'color-wand-outline' },
  personCircle: { sf: 'person.crop.circle', ion: 'person-circle-outline' },
  download: { sf: 'arrow.down.circle', ion: 'download-outline' },
  upload: { sf: 'arrow.up.doc', ion: 'cloud-upload-outline' },
  checklist: { sf: 'checklist', ion: 'checkbox-outline' },
  flag: { sf: 'flag', ion: 'flag-outline' },
  chat: { sf: 'text.bubble', ion: 'chatbubble-ellipses-outline' },
  briefcaseUser: { sf: 'person.text.rectangle', ion: 'id-card-outline' },
  target: { sf: 'scope', ion: 'locate-outline' },
  trending: { sf: 'chart.line.uptrend.xyaxis', ion: 'trending-up-outline' },
  mic: { sf: 'mic', ion: 'mic-outline' },
  compass: { sf: 'safari', ion: 'compass-outline' },
  cloud: { sf: 'icloud', ion: 'cloud-outline' },
  server: { sf: 'server.rack', ion: 'server-outline' },
  swap: { sf: 'arrow.left.arrow.right', ion: 'swap-horizontal-outline' },
  sparkle: { sf: 'sparkle', ion: 'sparkles-outline' },
  key: { sf: 'key', ion: 'key-outline' },
  logout: { sf: 'rectangle.portrait.and.arrow.right', ion: 'log-out-outline' },
  textFormat: { sf: 'textformat', ion: 'text-outline' },
  megaphone: { sf: 'megaphone', ion: 'megaphone-outline' },
  eyeCheck: { sf: 'doc.viewfinder', ion: 'scan-outline' },
  minus: { sf: 'minus', ion: 'remove' },
  tools: { sf: 'wrench.and.screwdriver', ion: 'construct-outline' },
  gauge: { sf: 'gauge.with.dots.needle.33percent', ion: 'speedometer-outline' },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  /** A colour token name or any colour. Default: label. */
  color?: keyof ColorTokens | (string & {});
  weight?: 'light' | 'regular' | 'medium' | 'semibold' | 'bold';
  /** Decorative by default; pass a label when the icon carries meaning alone. */
  accessibilityLabel?: string;
}

const DIRECTIONAL: IconName[] = ['chevronRight', 'chevronLeft', 'send'];

export function Icon(props: IconProps) {
  // Directional glyphs mirror in right-to-left languages.
  if (I18nManager.isRTL && DIRECTIONAL.includes(props.name)) {
    return (
      <View style={{ transform: [{ scaleX: -1 }] }}>
        <IconBase {...props} />
      </View>
    );
  }
  return <IconBase {...props} />;
}

function IconBase({ name, size = 22, color = 'label', weight = 'regular', accessibilityLabel }: IconProps) {
  const { colors } = useTheme();
  const tint: ColorValue = (colors as unknown as Record<string, string>)[color] ?? color;
  const def = ICONS[name];

  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={def.sf}
        size={size}
        weight={weight}
        tintColor={tint}
        resizeMode="scaleAspectFit"
        style={{ width: size, height: size }}
        accessibilityLabel={accessibilityLabel}
        accessible={!!accessibilityLabel}
        accessibilityElementsHidden={!accessibilityLabel}
        importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      />
    );
  }
  return (
    <Ionicons
      name={def.ion}
      size={size}
      color={tint}
      accessibilityLabel={accessibilityLabel}
      accessible={!!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    />
  );
}
