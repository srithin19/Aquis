/**
 * Celebration burst — Product Bible 06.11 / 06.14.
 *
 * "Confetti/bubbles should be restrained; 1–2 seconds maximum."
 *
 * A single radial burst of glowing bubbles from the hero, then a slow rise and
 * fade. Purely decorative and never blocks input — the MVP acceptance
 * criterion "animations never prevent the user from completing core actions"
 * (20).
 */

import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { duration, palette } from '@/theme';

const PARTICLES = 22;
const COLORS = [palette.teal300, palette.lavender400, palette.pink400, palette.lime400, palette.teal400];

export function Celebration({
  active,
  reduceMotion = false,
  originY,
}: {
  active: boolean;
  reduceMotion?: boolean;
  /** Vertical burst origin in screen points; defaults to a third of the way down. */
  originY?: number;
}) {
  const { width, height } = useWindowDimensions();

  if (!active || reduceMotion) return null;

  const cx = width / 2;
  const cy = originY ?? height * 0.33;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Ring cx={cx} cy={cy} />
      {Array.from({ length: PARTICLES }, (_, index) => (
        <Particle key={index} index={index} cx={cx} cy={cy} reach={width * 0.55} />
      ))}
    </View>
  );
}

function Ring({ cx, cy }: { cx: number; cy: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * 0.8,
    transform: [{ scale: 0.3 + t.value * 2.4 }],
  }));
  return <Animated.View style={[styles.ring, { left: cx - 80, top: cy - 80 }, style]} />;
}

function Particle({ index, cx, cy, reach }: { index: number; cx: number; cy: number; reach: number }) {
  const t = useSharedValue(0);

  // Deterministic spread: no randomness means no re-render jitter.
  const angle = (index / PARTICLES) * Math.PI * 2 + (index % 3) * 0.2;
  const distance = reach * (0.45 + ((index * 7) % 10) / 18);
  const size = 6 + ((index * 5) % 10);
  const tint = COLORS[index % COLORS.length];
  const delay = (index % 4) * 40;

  useEffect(() => {
    t.value = withDelay(
      delay,
      withTiming(1, { duration: duration.celebration, easing: Easing.out(Easing.quad) }),
    );
  }, [delay, t]);

  const style = useAnimatedStyle(() => {
    const burst = Math.min(t.value / 0.35, 1);
    const eased = 1 - Math.pow(1 - burst, 3);
    return {
      opacity: t.value < 0.1 ? t.value / 0.1 : 1 - Math.max(0, (t.value - 0.45) / 0.55),
      transform: [
        { translateX: Math.cos(angle) * distance * eased },
        // Burst out, then float upward like bubbles.
        { translateY: Math.sin(angle) * distance * eased - t.value * 90 },
        { scale: 1 - t.value * 0.4 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left: cx - size / 2,
          top: cy - size / 2,
          backgroundColor: tint,
          shadowColor: tint,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: palette.teal300,
  },
});
