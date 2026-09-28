/**
 * Calendar droplet — Product Bible 06.12.
 *
 * "Each day uses a water droplet whose fill represents completion percentage.
 * 100% is full; partial completion is visibly partial. Droplets animate from
 * empty to their stored completion level on first render."
 *
 * Cheap on purpose (a month shows ~30 of these): two static SVGs and one
 * Reanimated clip, no per-frame work once the fill has landed.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { palette } from '@/theme';

const PATH = 'M12 2.5c0 0 7.5 8.2 7.5 12.6a7.5 7.5 0 0 1-15 0C4.5 10.7 12 2.5 12 2.5Z';
const TOP = 2.5 / 24;
const BOTTOM = 22.6 / 24;

export function MiniDroplet({
  percent,
  size = 30,
  delay = 0,
  reduceMotion = false,
  dim = false,
}: {
  percent: number;
  size?: number;
  delay?: number;
  reduceMotion?: boolean;
  /** Future days or days outside any goal: outline only. */
  dim?: boolean;
}) {
  const ratio = Math.max(0, Math.min(percent, 100)) / 100;
  const level = useSharedValue(reduceMotion ? ratio : 0);
  const span = size * (BOTTOM - TOP);

  useEffect(() => {
    level.value = reduceMotion
      ? ratio
      : withDelay(delay, withTiming(ratio, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [ratio, delay, reduceMotion, level]);

  const clip = useAnimatedStyle(() => ({ height: level.value * span }));
  const complete = ratio >= 1;

  return (
    <View
      style={[
        { width: size, height: size },
        complete && [styles.glow, { shadowRadius: size / 3 }],
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d={PATH}
          fill={dim ? 'transparent' : 'rgba(255,255,255,0.05)'}
          stroke={dim ? 'rgba(255,255,255,0.12)' : 'rgba(155,241,244,0.35)'}
          strokeWidth={1.2}
        />
      </Svg>
      <Animated.View style={[styles.clip, { bottom: size * (1 - BOTTOM), width: size }, clip]}>
        <View style={{ position: 'absolute', bottom: -size * (1 - BOTTOM), width: size, height: size }}>
          <Svg width={size} height={size} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id="mini" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={complete ? palette.lime400 : palette.teal300} />
                <Stop offset="1" stopColor={complete ? palette.lime300 : palette.lavender500} />
              </LinearGradient>
            </Defs>
            <Path d={PATH} fill="url(#mini)" />
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
  },
  glow: {
    shadowColor: palette.lime400,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
  },
});
