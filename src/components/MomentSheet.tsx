/**
 * Badge reveal / streak milestone sheet — Product Bible 06.14 and 08:
 * "New badge uses mascot celebration and badge reveal animation."
 *
 * Choreography, all on one no-overshoot ease-out curve so nothing bounces:
 *   backdrop fades in → sheet glides up → a single glow ring blooms behind the
 *   badge → badge settles in from 94% → title and copy rise in sequence.
 * Total ≈ 600 ms. Leaving is quicker (~200 ms). Tap anywhere to dismiss.
 *
 * Global overlay driven by the provider's `moments` queue, so a badge earned
 * from any screen (or from a notification action) is celebrated exactly once.
 */

import React, { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '@/state/AppProvider';
import { color, duration, ease, palette, radius, spacing } from '@/theme';
import { play } from '@/services/sound';
import { haptic } from '@/utils/haptics';

import { Badge, TINTS } from './Badge';
import { Icon } from './Icon';
import { Mascot } from './Mascot';
import { Body, Button, Micro, Title, enterPop, enterUp } from './ui';

const SHEET_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 48 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: ease.out },
}).duration(duration.slow);

const SHEET_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 0, transform: [{ translateY: 32 }] },
}).duration(duration.quick + 40);

export function MomentSheet() {
  const { moments, dismissMoment, reduceMotion } = useAppState();
  const insets = useSafeAreaInsets();
  const moment = moments[0];
  const key = moment ? (moment.kind === 'badge' ? moment.achievement.id : `streak-${moment.length}`) : null;

  useEffect(() => {
    if (!key) return;
    haptic('success');
    play('swish');
    const timer = setTimeout(() => play('twinkle'), 160);
    return () => clearTimeout(timer);
  }, [key]);

  useEffect(() => {
    if (!key) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissMoment();
      return true;
    });
    return () => sub.remove();
  }, [key, dismissMoment]);

  if (!moment || !key) return null;

  const isBadge = moment.kind === 'badge';
  const glowColor = isBadge ? TINTS[moment.achievement.tint][0] : palette.orange400;

  return (
    <Animated.View
      key={key}
      entering={reduceMotion ? undefined : FadeIn.duration(duration.base).easing(ease.out)}
      exiting={reduceMotion ? undefined : FadeOut.duration(duration.quick)}
      style={styles.backdrop}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={dismissMoment} accessibilityLabel="Dismiss" />

      <Animated.View
        entering={reduceMotion ? undefined : SHEET_IN}
        exiting={reduceMotion ? undefined : SHEET_OUT}
        style={[styles.sheetWrap, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        <View style={styles.sheet}>
          <View style={styles.hero}>
            <View style={styles.cheer}>
              <Mascot state="celebrating" size={76} reduceMotion={reduceMotion} />
            </View>
            <GlowRing color={glowColor} reduceMotion={reduceMotion} />
            <Animated.View entering={enterPop(120, reduceMotion)}>
              {isBadge ? (
                <Badge id={moment.achievement.id} tint={moment.achievement.tint} earned size={92} />
              ) : (
                <View style={styles.streakBubble}>
                  <Icon name="flame" size={30} color={palette.ink950} strokeWidth={2.4} />
                  <Title tone="onAccent" style={styles.streakNumber}>
                    {moment.length}
                  </Title>
                </View>
              )}
            </Animated.View>
          </View>

          <Animated.View entering={enterUp(200, reduceMotion)}>
            <Micro tone="accent" center>
              {isBadge ? 'BADGE UNLOCKED' : 'STREAK MILESTONE'}
            </Micro>
            <Title center style={styles.title}>
              {isBadge ? moment.achievement.name : `${moment.length}-day streak`}
            </Title>
          </Animated.View>
          <Animated.View entering={enterUp(260, reduceMotion)}>
            <Body tone="secondary" center>
              {isBadge
                ? moment.achievement.description
                : `${moment.length} days in a row at 100%. Keep the flow going.`}
            </Body>
          </Animated.View>

          <Animated.View entering={enterUp(320, reduceMotion)} style={styles.action}>
            <Button label="Keep going" onPress={dismissMoment} />
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** One soft bloom behind the badge — plays once, then rests as a faint halo. */
function GlowRing({ color: tint, reduceMotion }: { color: string; reduceMotion: boolean }) {
  const t = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    t.value = withDelay(80, withTiming(1, { duration: 700, easing: ease.out }));
  }, [reduceMotion, t]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - t.value),
    transform: [{ scale: 0.7 + t.value * 0.9 }],
  }));
  const halo = useAnimatedStyle(() => ({
    opacity: 0.22 * t.value,
    transform: [{ scale: 0.8 + t.value * 0.2 }],
  }));

  return (
    <>
      <Animated.View style={[styles.halo, { backgroundColor: tint }, halo]} pointerEvents="none" />
      <Animated.View style={[styles.ring, { borderColor: tint }, ring]} pointerEvents="none" />
    </>
  );
}

const HERO = 150;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    paddingHorizontal: spacing.md,
  },
  sheet: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.borderStrong,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  hero: {
    height: HERO,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  cheer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  halo: {
    position: 'absolute',
    width: HERO,
    height: HERO,
    borderRadius: HERO / 2,
  },
  ring: {
    position: 'absolute',
    width: HERO * 0.8,
    height: HERO * 0.8,
    borderRadius: HERO * 0.4,
    borderWidth: 2,
  },
  streakBubble: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.orange400,
  },
  streakNumber: {
    fontSize: 22,
    lineHeight: 24,
  },
  title: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  action: {
    marginTop: spacing.xl,
  },
});
