import { useReducedMotion } from 'react-native-reanimated';

/** True when the user asked the OS to reduce motion. */
export function useReduceMotion() {
  return useReducedMotion();
}
