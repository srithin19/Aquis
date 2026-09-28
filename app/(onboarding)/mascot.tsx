/**
 * Mascot introduction — Product Bible 06.7.
 *
 * "Keep copy short and friendly. Do not over-explain the mascot."
 * Animation: wave -> blink -> small smile -> settle into idle.
 */

import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MascotStage, type MascotState } from '@/components/Mascot';
import { Body, Button, Caption, Display, Screen, Spacer } from '@/components/ui';
import { useAppState } from '@/state/AppProvider';
import { spacing } from '@/theme';
import { play } from '@/services/sound';
import { haptic } from '@/utils/haptics';

/** The introduction beat, kept short enough not to delay the Continue button. */
const SEQUENCE: { state: MascotState; hold: number }[] = [
  { state: 'happy', hold: 1600 },
  { state: 'excited', hold: 1300 },
  { state: 'idle', hold: 0 },
];

export default function MascotIntroScreen() {
  const { reduceMotion } = useAppState();
  const [step, setStep] = useState(0);
  const [pokes, setPokes] = useState(0);

  useEffect(() => {
    // Reduce Motion: settle on the resting pose immediately (08).
    if (reduceMotion) {
      setStep(SEQUENCE.length - 1);
      return;
    }
    if (step >= SEQUENCE.length - 1) return;
    const timer = setTimeout(() => setStep((current) => current + 1), SEQUENCE[step].hold);
    return () => clearTimeout(timer);
  }, [step, reduceMotion]);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Say hi to your droplet"
          onPress={() => {
            haptic('light');
            play('pop');
            setPokes((n) => n + 1);
          }}
        >
          <MascotStage state={SEQUENCE[step].state} size={200} reduceMotion={reduceMotion} pokeKey={pokes} />
        </Pressable>
        <Caption tone="muted" center style={styles.hint}>
          Go on, give it a tap.
        </Caption>
      </View>

      <View>
        <Display center>Meet your glass of water.</Display>
        <Spacer size={spacing.md} />
        <Body tone="secondary" center>
          It fills as you drink, and it has opinions about how your day is going.
        </Body>
      </View>

      <Button label="Continue" onPress={() => router.push('/(onboarding)/confirm')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: spacing.lg,
  },
});
