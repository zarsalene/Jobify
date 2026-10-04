import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { data } from '@/state/data';
import { initApp } from '@/state/init';
import { preferences } from '@/state/preferences';
import { profile } from '@/state/profile';
import { session } from '@/state/session';
import { colors, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const theme = useTheme();
  // Re-render on language change so the whole tree picks up new strings.
  useT();

  const status = session.use((s) => s.status);
  const prefsReady = preferences.use((s) => s.hydrated);
  const profileReady = profile.use((s) => s.hydrated);
  const dataReady = data.use((s) => s.hydrated);
  const hydrated = prefsReady && profileReady && dataReady;
  const consentDone = profile.use((s) => s.consentDone);
  const setupDone = profile.use((s) => s.setupDone);
  const cvDone = profile.use((s) => s.cvDone);

  useEffect(() => {
    void initApp().finally(() => setReady(true));
  }, []);

  const loaded = ready && hydrated && status !== 'loading';
  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  const signedOut = status === 'signedOut';
  const onboarded = consentDone && setupDone && cvDone;

  const c = colors[theme.scheme];
  const navTheme = {
    ...DefaultTheme,
    dark: theme.isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: c.accent,
      background: c.groupedBackground,
      card: c.card,
      text: c.label,
      border: c.separator,
      notification: c.red,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.groupedBackground }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={theme.isDark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.groupedBackground } }}>
            <Stack.Protected guard={signedOut}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={!signedOut && !onboarded}>
              <Stack.Screen name="(onboarding)" />
            </Stack.Protected>
            <Stack.Protected guard={!signedOut && onboarded}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
