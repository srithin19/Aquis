/**
 * Splash — Product Bible 06.1.
 *
 * "Load local database, goal state and notification state before navigation.
 * Animation duration: ~800–1400 ms; never block unnecessarily."
 * Animation: logo fade-in → mascot tiny float → water ripple → route.
 *
 * The minimum dwell and the data load run concurrently: whichever finishes last
 * decides when we route.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Mascot } from '@/components/Mascot';
import { Body, Button, Screen } from '@/components/ui';
import { useAppState } from '@/state/AppProvider';
import { duration, font, palette, spacing, spring } from '@/theme';

const MIN_SPLASH_MS = 800;

export default function SplashScreen() {
  const { ready, bootstrapError, profile, activeGoal, goalSummary, refresh, reduceMotion } = useAppState();
  const [dwellDone, setDwellDone] = useState(false);
  const navigated = useRef(false);

  const logoOpacity = useSharedValue(0);
  const logoLift = useSharedValue(16);
  const mascotScale = useSharedValue(0.6);
  const ring = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => setDwellDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      logoOpacity.value = 1;
      logoLift.value = 0;
      mascotScale.value = 1;
      return;
    }
    mascotScale.value = withSpring(1, spring.pop);
    logoOpacity.value = withDelay(150, withTiming(1, { duration: duration.slow, easing: Easing.out(Easing.quad) }));
    logoLift.value = withDelay(150, withTiming(0, { duration: duration.slow, easing: Easing.out(Easing.quad) }));
    ring.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );
  }, [reduceMotion, logoOpacity, logoLift, mascotScale, ring]);

  useEffect(() => {
    if (!ready || !dwellDone || bootstrapError || navigated.current) return;
    navigated.current = true;

    if (!profile) {
      router.replace('/(onboarding)/welcome');
    } else if (goalSummary) {
      // A goal period ended since the last visit — show how it went first (04).
      router.replace('/goal-summary');
    } else if (!activeGoal) {
      router.replace('/(onboarding)/goal');
    } else {
      router.replace('/(tabs)');
    }
  }, [ready, dwellDone, bootstrapError, profile, activeGoal, goalSummary]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoLift.value }],
  }));
  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ scale: mascotScale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.5,
    transform: [{ scale: 0.6 + ring.value * 1.2 }],
  }));

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.stack}>
        <View style={styles.mascotWrap}>
          {!reduceMotion ? <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" /> : null}
          <Animated.View style={mascotStyle}>
            <Mascot state="happy" size={140} reduceMotion={reduceMotion} />
          </Animated.View>
        </View>
        <Animated.View style={[styles.logo, logoStyle]}>
          <LinearGradient
            colors={[palette.teal300, palette.lavender400]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.wordmarkBar}
          />
          <Animated.Text style={styles.wordmark}>AQUIS</Animated.Text>
          <Body tone="secondary" center>
            Hydration, without the nagging.
          </Body>
        </Animated.View>
      </View>

      {bootstrapError ? (
        <View style={styles.error}>
          <Body tone="secondary" center>
            AQUIS could not open its local storage.
          </Body>
          <Body tone="muted" center style={styles.errorDetail}>
            {bootstrapError}
          </Body>
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => {
              navigated.current = false;
              void refresh();
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    alignItems: 'center',
    gap: spacing.xl,
  },
  mascotWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: palette.teal400,
  },
  logo: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordmarkBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  wordmark: {
    fontFamily: font.display,
    fontSize: 44,
    letterSpacing: 10,
    color: palette.text50,
    marginLeft: 10,
  },
  error: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: 0,
    right: 0,
    gap: spacing.md,
  },
  errorDetail: {
    marginBottom: spacing.sm,
  },
});
