import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MomentSheet } from '@/components/MomentSheet';
import { track } from '@/services/analytics';
import { preloadSounds } from '@/services/sound';
import {
  ACTION_LOG_ML,
  configureNotifications,
  subscribeToResponses,
  type ReminderResponse,
} from '@/services/notificationService';
import { AppProvider, useAppState } from '@/state/AppProvider';
import { OnboardingProvider } from '@/state/OnboardingProvider';
import { color, palette } from '@/theme';
import { haptic } from '@/utils/haptics';

configureNotifications();
preloadSounds();

/**
 * React Navigation paints every screen, card and modal with its theme's
 * background — a light grey by default. Without this, any surface we don't
 * style ourselves (and every transition) flashes near-white.
 */
const NAV_THEME = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: palette.lime400,
    background: color.background,
    card: color.surface,
    text: color.textPrimary,
    border: color.border,
    notification: palette.lime400,
  },
};

/** 08 — "Short crossfade/slide; avoid excessive transitions." Kept snappy. */
const SCREEN_FADE_MS = 180;
const SHEET_MS = 260;
void SystemUI.setBackgroundColorAsync(color.background).catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.background }}>
      <SafeAreaProvider>
        <ThemeProvider value={NAV_THEME}>
        <AppProvider>
          <OnboardingProvider>
            <StatusBar style="light" />
            <Shell>
              {fontsLoaded || fontError ? (
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: color.background },
                    animation: 'fade',
                    animationDuration: SCREEN_FADE_MS,
                  }}
                >
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(onboarding)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="custom-amount"
                    options={{
                      presentation: 'modal',
                      animation: 'slide_from_bottom',
                      animationDuration: SHEET_MS,
                      contentStyle: { backgroundColor: color.surfaceSolid },
                    }}
                  />
                  <Stack.Screen
                    name="day/[date]"
                    options={{
                      presentation: 'modal',
                      animation: 'slide_from_bottom',
                      animationDuration: SHEET_MS,
                      contentStyle: { backgroundColor: color.surfaceSolid },
                    }}
                  />
                  <Stack.Screen name="goal-summary" options={{ gestureEnabled: false }} />
                </Stack>
              ) : null}
            </Shell>
          </OnboardingProvider>
        </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** The screens, plus the global overlays that sit above every route. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      {children}
      <NotificationBridge />
      <MomentSheet />
    </View>
  );
}

/**
 * 20 — "Notification action deep-link to Home." A tap opens Home; the
 * "Log 250 ml" action logs straight from the notification. Responses that
 * arrive before the app has loaded wait until it has.
 */
function NotificationBridge() {
  const { ready, profile, goalSummary, logWater } = useAppState();
  const pending = useRef<ReminderResponse[]>([]);
  const readyRef = useRef(false);
  const handleRef = useRef<(response: ReminderResponse) => void>(() => {});

  handleRef.current = (response) => {
    track('notification_opened', { action: response.logRequested ? 'logged' : 'opened' });
    // The drink happened — record it even if the goal period just closed; a
    // new goal started today picks it up.
    if (response.logRequested) {
      void logWater(ACTION_LOG_ML, 'notification')
        .then(() => haptic('light'))
        .catch(() => {});
    }
    // A finished goal's summary takes priority; the splash / Home route to it.
    if (!goalSummary) router.navigate('/(tabs)');
  };

  useEffect(() => {
    return subscribeToResponses((response) => {
      if (readyRef.current) handleRef.current(response);
      else pending.current.push(response);
    });
  }, []);

  useEffect(() => {
    readyRef.current = ready && !!profile;
    if (!readyRef.current) return;
    // Give the splash a beat to route before we navigate over it. Responses
    // stay queued until actually handled, so a re-run of this effect can't drop them.
    const timer = setTimeout(() => {
      pending.current.splice(0).forEach((r) => handleRef.current(r));
    }, 1200);
    return () => clearTimeout(timer);
  }, [ready, profile]);

  return null;
}
