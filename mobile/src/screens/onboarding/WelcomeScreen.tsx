import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, View, useWindowDimensions, type ViewToken } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Text, type IconName } from '@/components/ui';
import { APP_NAME } from '@/constants/app';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useT, type TKey } from '@/i18n';
import { PAGE_MARGIN, radii, useTheme } from '@/theme';

const SLIDES: { icon: IconName; title: TKey; body: TKey }[] = [
  { icon: 'target', title: 'onboarding.slide1Title', body: 'onboarding.slide1Body' },
  { icon: 'wand', title: 'onboarding.slide2Title', body: 'onboarding.slide2Body' },
  { icon: 'shield', title: 'onboarding.slide3Title', body: 'onboarding.slide3Body' },
];

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const [page, setPage] = useState(0);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const i = viewableItems[0]?.index;
    if (typeof i === 'number') setPage(i);
  }).current;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <Text variant="headline" color="secondaryLabel" align="center" style={{ marginTop: 16 }}>
        {APP_NAME}
      </Text>

      <FlatList
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: PAGE_MARGIN + 8, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
            <Animated.View
              entering={reduce ? undefined : FadeIn.duration(400)}
              style={{
                width: 120,
                height: 120,
                borderRadius: 28,
                backgroundColor: colors.accentTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name={item.icon} size={56} color="accent" weight="light" />
            </Animated.View>
            <Text variant="title1" align="center" accessibilityRole="header">
              {t(item.title)}
            </Text>
            <Text variant="body" color="secondaryLabel" align="center" style={{ maxWidth: 420 }}>
              {t(item.body)}
            </Text>
          </View>
        )}
      />

      <View
        accessible
        accessibilityLabel={t('onboarding.pageOf', { current: page + 1, total: SLIDES.length })}
        style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: radii.pill,
              backgroundColor: i === page ? colors.accent : colors.quaternaryLabel,
            }}
          />
        ))}
      </View>

      <View style={{ paddingHorizontal: PAGE_MARGIN, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 4 }}>
        <Button title={t('onboarding.getStarted')} onPress={() => router.push('/signup')} />
        <Button title={t('onboarding.haveAccount')} variant="plain" size="medium" onPress={() => router.push('/login')} />
      </View>
    </View>
  );
}
