/**
 * Goal-complete confetti — Product Bible 06.11.
 *
 * A single shower of paper in the Matiks palette: pieces drop in from above
 * the screen, sway, spin and flip like real paper, and are gone in ~2.6 s.
 * Deterministic layout (no Math.random) so re-renders never jitter, and
 * `pointerEvents="none"` so it never blocks a tap (20).
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

import { palette } from '@/theme';

const PIECES = 44;
const COLORS = [
  palette.lime400,
  palette.lavender400,
  palette.pink400,
  palette.yellow400,
  palette.teal400,
  palette.orange400,
];

export function Confetti({ active, reduceMotion = false }: { active: boolean; reduceMotion?: boolean }) {
  const { width, height } = useWindowDimensions();
  if (!active || reduceMotion) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: PIECES }, (_, i) => (
        <Piece key={i} index={i} width={width} height={height} />
      ))}
    </View>
  );
}

function Piece({ index, width, height }: { index: number; width: number; height: number }) {
  const t = useSharedValue(0);

  // Golden-ratio spread across the width; varied size, speed and spin.
  const x = ((index * 0.618034) % 1) * width;
  const w = 6 + (index % 3) * 3;
  const h = index % 4 === 0 ? w : w * 1.8;
  const round = index % 5 === 0;
  const tint = COLORS[index % COLORS.length];
  const delay = (index % 11) * 55;
  const fall = 2000 + (index % 7) * 110;
  const sway = 18 + (index % 4) * 10;
  const spin = (index % 2 === 0 ? 1 : -1) * (360 + (index % 5) * 140);

  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: fall, easing: Easing.bezier(0.25, 0.6, 0.45, 1) }));
  }, [delay, fall, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.05 ? t.value / 0.05 : t.value > 0.8 ? (1 - t.value) / 0.2 : 1,
    transform: [
      { translateX: Math.sin(t.value * Math.PI * 3 + index) * sway },
      { translateY: -40 + t.value * (height + 80) },
      { rotateZ: `${t.value * spin}deg` },
      // A paper flip: the piece narrows and widens as it tumbles.
      { scaleX: Math.cos(t.value * Math.PI * 6 + index) },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        { left: x, width: w, height: h, backgroundColor: tint, borderRadius: round ? w / 2 : 2 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: 0,
  },
});
