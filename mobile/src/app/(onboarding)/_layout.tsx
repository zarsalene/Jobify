import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/useStackOptions';

export const unstable_settings = { initialRouteName: 'consent' };

export default function OnboardingLayout() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={{ ...options, headerTransparent: true, headerBlurEffect: undefined, headerTitle: '', gestureEnabled: false }}>
      <Stack.Screen name="consent" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false }} />
      <Stack.Screen name="cv-upload" options={{ headerShown: false }} />
      <Stack.Screen name="cv-review" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}
