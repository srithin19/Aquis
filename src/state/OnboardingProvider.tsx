/**
 * Onboarding draft state.
 *
 * The goal the user is assembling across 06.4 -> 06.5 -> 06.6 -> 06.8 is not a
 * domain record until they tap "Start my goal" on the confirmation screen, so
 * it lives here as transient UI state (16) rather than being written to the
 * database a field at a time.
 */

import React, { createContext, useContext, useMemo, useState } from 'react';

import { DEFAULT_QUICK_ADD_ML } from '@/domain/hydration';

interface OnboardingDraft {
  dailyGoalMl: number;
  durationDays: number;
  notificationsEnabled: boolean;
}

interface OnboardingValue extends OnboardingDraft {
  setDailyGoalMl(ml: number): void;
  setDurationDays(days: number): void;
  setNotificationsEnabled(enabled: boolean): void;
  /** Start the draft from what the user already has (new goal from inside the app). */
  seed(draft: OnboardingDraft): void;
  reset(): void;
}

const DEFAULT_DRAFT: OnboardingDraft = {
  dailyGoalMl: 2000,
  durationDays: 7,
  notificationsEnabled: true,
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft>(DEFAULT_DRAFT);

  const value = useMemo<OnboardingValue>(
    () => ({
      ...draft,
      setDailyGoalMl: (dailyGoalMl) => setDraft((current) => ({ ...current, dailyGoalMl })),
      setDurationDays: (durationDays) => setDraft((current) => ({ ...current, durationDays })),
      setNotificationsEnabled: (notificationsEnabled) =>
        setDraft((current) => ({ ...current, notificationsEnabled })),
      seed: (next) => setDraft(next),
      reset: () => setDraft(DEFAULT_DRAFT),
    }),
    [draft],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error('useOnboarding must be used inside <OnboardingProvider>.');
  return value;
}

export { DEFAULT_QUICK_ADD_ML };
