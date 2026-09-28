/**
 * Shared test plumbing: a fresh database per test, the real providers around
 * whatever is rendered, and handles on the recorded native calls.
 */

import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import React from 'react';

import { AppProvider, useAppState } from '@/state/AppProvider';
import { OnboardingProvider } from '@/state/OnboardingProvider';

import { __query, __resetDatabase } from './shims/expo-sqlite';

export const query = __query;

export const nav = router as unknown as Record<
  'push' | 'replace' | 'back' | 'navigate' | 'dismissTo' | 'canGoBack',
  jest.Mock
>;

/** Route params for screens that read useLocalSearchParams (see test/setup). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const routeParams: Record<string, string> = require('expo-router').__params;

/**
 * Buttons ignore a second press within 600 ms (double-tap guard). Tests that
 * press the same button again call this to step past the guard.
 */
let clockOffset = 0;
const realNow = Date.now.bind(Date);
jest.spyOn(Date, 'now').mockImplementation(() => realNow() + clockOffset);
export function waitPastDoubleTap() {
  clockOffset += 700;
}

export function scheduled(): { content: { title: string; body: string; data: Record<string, unknown> }; trigger: { date?: Date; seconds?: number } }[] {
  return (Notifications as unknown as { __scheduled: never[] }).__scheduled;
}

export function setPermission(granted: boolean, canAskAgain = true) {
  Object.assign((Notifications as unknown as { __permission: object }).__permission, { granted, canAskAgain });
}

export function alerts(): { title: string; message?: string }[] {
  return (global as unknown as { __alerts: { title: string }[] }).__alerts;
}

export function chooseAlert(text: string | undefined) {
  (global as unknown as { __alertChoice?: string }).__alertChoice = text;
}

export async function freshStart() {
  await __resetDatabase();
  jest.clearAllMocks();
  scheduled().length = 0;
  alerts().length = 0;
  chooseAlert(undefined);
  setPermission(true);
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <OnboardingProvider>{children}</OnboardingProvider>
    </AppProvider>
  );
}

/** The live provider state, re-read after every act(). */
export async function mountApp() {
  const hook = await renderHook(() => useAppState(), { wrapper: Providers });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  await settle();
  return hook;
}

/** Render a screen inside the real providers and wait for the first load. */
export async function renderScreen(element: React.ReactElement) {
  let state: ReturnType<typeof useAppState> | null = null;
  function Probe() {
    state = useAppState();
    return null;
  }
  const screen = await render(
    <Providers>
      <Probe />
      {element}
    </Providers>,
  );
  await waitFor(() => expect(state?.ready).toBe(true));
  await settle();
  return { screen, state: () => state as unknown as ReturnType<typeof useAppState> };
}

/** Let queued promises (DB writes, reminder syncs) finish. */
export async function settle() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
  }
}

/** Sign in and start a goal straight through the provider. */
export async function onboard(
  app: { current: ReturnType<typeof useAppState> },
  goal = { dailyGoalMl: 2000, durationDays: 7 },
) {
  await act(async () => {
    await app.current.signIn({ provider: 'google' });
  });
  await act(async () => {
    await app.current.updateSettings({ notificationsEnabled: true, onboardingCompleted: true });
    await app.current.startGoal(goal);
  });
  await settle();
}
