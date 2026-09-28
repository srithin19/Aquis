/**
 * Circular progress halo around the Home mascot.
 *
 * A Skia sweep-gradient arc with a soft glow, springing to the day's ratio.
 * It is redundant with the number underneath on purpose: 08 says never make
 * animation the only way to understand progress.
 */

import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import {
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ease, palette, spring } from '@/theme';

export function ProgressRing({
  size,
  progress,
  stroke = 10,
  reduceMotion = false,
  complete = false,
}: {
  size: number;
  progress: number;
  stroke?: number;
  reduceMotion?: boolean;
  complete?: boolean;
}) {
  const value = useSharedValue(0);
  const pulse = useSharedValue(0);

  // Goal reached: the halo flares once.
  useEffect(() => {
    if (!complete || reduceMotion) return;
    pulse.value = withSequence(
      withTiming(1, { duration: 260, easing: ease.out }),
      withTiming(0, { duration: 1400, easing: ease.out }),
    );
  }, [complete, reduceMotion, pulse]);

  useEffect(() => {
    const target = Math.max(0, Math.min(progress, 1));
    value.value = reduceMotion ? withTiming(target, { duration: 0 }) : withSpring(target, spring.water);
  }, [progress, reduceMotion, value]);

  const r = (size - stroke) / 2 - 6;
  const c = size / 2;

  const track = useMemo(() => {
    return Skia.PathBuilder.Make().addCircle(c, c, r).build();
  }, [c, r]);

  const arc = useMemo(() => {
    // Start at 12 o'clock.
    return Skia.PathBuilder.Make()
      .addArc({ x: c - r, y: c - r, width: r * 2, height: r * 2 }, -90, 359.9)
      .build();
  }, [c, r]);

  const end = useDerivedValue(() => Math.max(value.value, 0.001));
  const headAngle = useDerivedValue(() => -Math.PI / 2 + value.value * Math.PI * 2);
  const headX = useDerivedValue(() => c + r * Math.cos(headAngle.value));
  const headY = useDerivedValue(() => c + r * Math.sin(headAngle.value));
  const headOpacity = useDerivedValue(() => (value.value > 0.01 ? 1 : 0));
  const glowOpacity = useDerivedValue(() => 0.5 + pulse.value * 0.5);
  const glowWidth = useDerivedValue(() => stroke * (1 + pulse.value * 1.6));

  const colors = complete
    ? [palette.lime400, palette.lime300, palette.teal400, palette.lime400]
    : [palette.teal400, palette.lavender500, palette.pink400, palette.teal400];

  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={track} style="stroke" strokeWidth={stroke} color="rgba(255,255,255,0.07)" />
      <Group>
        <Path path={arc} style="stroke" strokeWidth={glowWidth} strokeCap="round" start={0} end={end} opacity={glowOpacity}>
          <SweepGradient c={vec(c, c)} colors={colors} />
          <BlurMask blur={10} style="solid" />
        </Path>
        <Path path={arc} style="stroke" strokeWidth={stroke} strokeCap="round" start={0} end={end}>
          <SweepGradient c={vec(c, c)} colors={colors} />
        </Path>
      </Group>
      <Circle cx={headX} cy={headY} r={stroke / 2 - 1.5} color={palette.white} opacity={headOpacity} />
    </Canvas>
  );
}
