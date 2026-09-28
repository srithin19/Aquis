/**
 * Welcome — Product Bible 06.2.
 * "Explain the product in one screen." Mascot waves; nothing else competes.
 */

import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { MascotStage } from '@/components/Mascot';
import { Body, Button, Display, enterPop, enterUp, Micro, Screen } from '@/components/ui';
import { useAppState } from '@/state/AppProvider';
import { palette, spacing } from '@/theme';

export default function WelcomeScreen() {
  const { reduceMotion } = useAppState();
  const enter = (delay: number) => enterUp(delay, reduceMotion);

  return (
    <Screen contentStyle={styles.content}>
      {/* "Large mascot occupying the upper half." */}
      <Animated.View entering={enterPop(0, reduceMotion)} style={styles.hero}>
        <MascotStage state="happy" size={200} reduceMotion={reduceMotion} />
      </Animated.View>

      <View style={styles.copy}>
        <Animated.View entering={enter(120)}>
          <Micro tone="accent" center>
            MEET AQUIS
          </Micro>
        </Animated.View>
        <Animated.View entering={enter(200)}>
          <Display center style={styles.headline}>
            Hydration,{'\n'}
            <Display style={styles.highlight}>without the nagging.</Display>
          </Display>
        </Animated.View>
        <Animated.View entering={enter(300)}>
          <Body tone="secondary" center>
            A tiny water companion that fills up as you drink and only speaks up when a sip actually
            makes sense.
          </Body>
        </Animated.View>
      </View>

      <Animated.View entering={enter(420)} style={styles.actions}>
        <Button label="Get started" onPress={() => router.push('/(onboarding)/sign-in')} />
        <Button
          label="Already have an account? Sign in"
          variant="ghost"
          onPress={() => router.push('/(onboarding)/sign-in')}
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  headline: {
    marginTop: spacing.xs,
  },
  highlight: {
    color: palette.teal300,
  },
  actions: {
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
});
