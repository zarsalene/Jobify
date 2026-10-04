import { router } from 'expo-router';

import { SetupWizard } from '@/screens/onboarding/SetupWizard';
import { profile, saveSetup } from '@/state/profile';

/** Edit the same preferences as the setup wizard, after onboarding. */
export default function SearchPreferencesScreen() {
  return (
    <SetupWizard
      initial={profile.get().setup}
      onDone={(s) => {
        saveSetup(s);
        router.back();
      }}
      onSkip={() => router.back()}
    />
  );
}
