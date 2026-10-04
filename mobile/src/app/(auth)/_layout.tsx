import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/useStackOptions';

export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={{ ...options, headerTransparent: true, headerBlurEffect: undefined, headerTitle: '' }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot" />
    </Stack>
  );
}
