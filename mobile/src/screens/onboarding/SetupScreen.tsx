import { router } from 'expo-router';

import { profile, saveSetup } from '@/state/profile';

import { SetupWizard } from './SetupWizard';

export default function SetupScreen() {
  return (
    <SetupWizard
      topInset
      initial={profile.get().setup}
      onDone={(s) => {
        saveSetup(s);
        router.replace('/cv-upload');
      }}
      onSkip={() => {
        saveSetup(undefined);
        router.replace('/cv-upload');
      }}
    />
  );
}
