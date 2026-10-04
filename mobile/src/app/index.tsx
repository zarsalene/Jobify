import { Redirect } from 'expo-router';

/** Entry: route guards in the root layout send signed-out users to onboarding. */
export default function Index() {
  return <Redirect href="/home" />;
}
