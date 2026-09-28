import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme';

/** Height of the floating tab bar in `app/(tabs)/_layout.tsx`. */
export const TAB_BAR_HEIGHT = 68;

/** Bottom padding a tab screen needs so its last row clears the floating bar. */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, spacing.md) + spacing.xl;
}
