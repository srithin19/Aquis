/**
 * The mascot — Product Bible 07.
 *
 * One water droplet with a personality. Every feeling is a *pose*: numbers for
 * the eyes, mouth, brows, cheeks and little effects (tears, sparkles,
 * zzz…). Changing state eases each number to its new value, so the face morphs
 * smoothly from one feeling to the next instead of snapping. On top of that,
 * each feeling has its own body language — a hop, a shiver, a sulk.
 *
 * The droplet doubles as the progress gauge: pass `fill` (0–1) and it holds
 * that much water, rendered in Skia on the UI thread — two sine waves under a
 * gradient, rising bubbles, and a slosh whenever the level moves.
 *
 * The face is drawn twice and clipped at the waterline — dark ink under the
 * surface, light ink above it — so it reads at every fill level.
 *
 * 07 — "never shame the user, imply danger, or create anxiety": the sad pose is
 * a soft pout with one small tear, and thirsty is sleepy-dry, not distressed.
 */

import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  Skia,
  rect,
  useClock,
  usePathValue,
  vec,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ease, palette, spring } from '@/theme';

export type MascotState =
  | 'idle'
  | 'happy'
  | 'drink'
  | 'thinking'
  | 'thirsty'
  | 'excited'
  | 'celebrating'
  | 'proud'
  | 'sleepy'
  | 'sad'
  // Tap reactions — played for a moment, then the mascot returns to its mood.
  | 'giggle'
  | 'wink'
  | 'surprised'
  | 'love';

/** What a tap does, in order: each tap plays the next one. */
export const TAP_REACTIONS = ['giggle', 'wink', 'surprised', 'love'] as const;
export type TapReaction = (typeof TAP_REACTIONS)[number];

/** The reaction a given poke count plays (1st tap → giggle, 2nd → wink…). */
export function tapReactionFor(pokeKey: number): TapReaction {
  return TAP_REACTIONS[(Math.max(pokeKey, 1) - 1) % TAP_REACTIONS.length];
}

const TAP_MS = 1500;

/* -------------------------------------------------------------- the poses */

interface Pose {
  /** Upper and lower eye curve heights. A negative lower curve makes a ^ crescent. */
  eyeTop: number;
  eyeBottom: number;
  eyeScale: number;
  lookX: number;
  lookY: number;
  /** + smile, − frown. */
  mouthCurve: number;
  mouthWidth: number;
  /** 0 closed line … 1 wide open. */
  mouthOpen: number;
  /** −1 worried (inner ends up) … +1 raised. */
  brow: number;
  browAlpha: number;
  blush: number;
  /** Darkening wash over the body (thirsty / sad). */
  tint: number;
  tear: number;
  sweat: number;
  zzz: number;
  sparkle: number;
  /** 0 both eyes open … 1 the right eye closed in a wink. */
  wink: number;
  think: number;
  glow: number;
}

const BASE: Pose = {
  eyeTop: 5.2,
  eyeBottom: 5.2,
  eyeScale: 1,
  lookX: 0,
  lookY: 0,
  mouthCurve: 4,
  mouthWidth: 6,
  mouthOpen: 0,
  brow: 0,
  browAlpha: 0,
  blush: 0.35,
  tint: 0,
  tear: 0,
  sweat: 0,
  zzz: 0,
  sparkle: 0,
  wink: 0,
  think: 0,
  glow: 0,
};

const POSES: Record<MascotState, Pose> = {
  idle: BASE,
  // Beaming.
  happy: {
    ...BASE,
    eyeTop: 5.6,
    eyeBottom: -2.4,
    mouthCurve: 7,
    mouthWidth: 8,
    mouthOpen: 0.45,
    blush: 0.75,
  },
  // Eyes shut, lips pursed — glug, glug.
  drink: {
    ...BASE,
    eyeTop: 1.6,
    eyeBottom: -0.8,
    mouthCurve: 0,
    mouthWidth: 3,
    mouthOpen: 0.75,
    blush: 0.6,
  },
  // Looking up and aside, pondering.
  thinking: {
    ...BASE,
    eyeTop: 6,
    eyeBottom: 5.4,
    lookX: -2.6,
    lookY: -2,
    mouthCurve: -0.8,
    mouthWidth: 4,
    brow: 0.7,
    browAlpha: 1,
    blush: 0.2,
    think: 1,
  },
  // Heavy-lidded and a little dry.
  thirsty: {
    ...BASE,
    eyeTop: 2.6,
    eyeBottom: 4.4,
    lookY: 1,
    mouthCurve: -1.2,
    mouthWidth: 4.6,
    mouthOpen: 0.3,
    brow: -0.4,
    browAlpha: 0.7,
    blush: 0,
    tint: 0.28,
    sweat: 1,
  },
  // Big shiny eyes — almost there!
  excited: {
    ...BASE,
    eyeTop: 6.4,
    eyeBottom: 6.4,
    eyeScale: 1.14,
    mouthCurve: 7,
    mouthWidth: 8,
    mouthOpen: 0.5,
    brow: 0.8,
    browAlpha: 0.9,
    blush: 0.7,
    sparkle: 0.7,
    glow: 0.5,
  },
  // Mouth wide open, stars everywhere.
  celebrating: {
    ...BASE,
    eyeTop: 6,
    eyeBottom: -3,
    mouthCurve: 9,
    mouthWidth: 9.5,
    mouthOpen: 1,
    brow: 0.9,
    browAlpha: 0.9,
    blush: 0.95,
    sparkle: 1,
    glow: 1,
  },
  // Goal done: calm, content, softly glowing.
  proud: {
    ...BASE,
    eyeTop: 5,
    eyeBottom: -2,
    mouthCurve: 6.5,
    mouthWidth: 7,
    mouthOpen: 0.2,
    blush: 0.8,
    sparkle: 0.45,
    glow: 0.6,
  },
  sleepy: {
    ...BASE,
    eyeTop: 0.9,
    eyeBottom: 0.9,
    lookY: 1.5,
    mouthCurve: 1.5,
    mouthWidth: 3,
    mouthOpen: 0.15,
    blush: 0.3,
    tint: 0.12,
    zzz: 1,
  },
  // Tap: squeezed-shut laughing eyes, big open grin.
  giggle: {
    ...BASE,
    eyeTop: 4.4,
    eyeBottom: -1.4,
    mouthCurve: 8,
    mouthWidth: 8.5,
    mouthOpen: 0.85,
    brow: 0.5,
    browAlpha: 0.6,
    blush: 1,
  },
  // Tap: a cheeky wink and a smirk.
  wink: {
    ...BASE,
    wink: 1,
    mouthCurve: 6,
    mouthWidth: 6.5,
    mouthOpen: 0.1,
    brow: 0.35,
    browAlpha: 0.5,
    blush: 0.75,
  },
  // Tap: "oh!" — wide eyes, raised brows, a little o.
  surprised: {
    ...BASE,
    eyeTop: 6.8,
    eyeBottom: 6.8,
    eyeScale: 1.2,
    // A round "o": the upper lip arches up while the lower drops.
    mouthCurve: -2,
    mouthWidth: 3.4,
    mouthOpen: 1,
    brow: 1,
    browAlpha: 1,
    blush: 0.3,
  },
  // Tap: dreamy crescent eyes, rosy cheeks — and a burst of hearts.
  love: {
    ...BASE,
    eyeTop: 5,
    eyeBottom: -2,
    mouthCurve: 7,
    mouthWidth: 7,
    mouthOpen: 0.3,
    blush: 1,
    glow: 0.3,
  },
  // A soft pout and a single tear — disappointed, never guilt-tripping.
  sad: {
    ...BASE,
    eyeTop: 4.6,
    eyeBottom: 5.2,
    lookY: 1.6,
    mouthCurve: -3.4,
    mouthWidth: 5.2,
    brow: -1,
    browAlpha: 1,
    blush: 0.15,
    tint: 0.16,
    tear: 1,
  },
};

const POSE_KEYS = Object.keys(BASE) as (keyof Pose)[];
type PoseValues = Record<keyof Pose, SharedValue<number>>;

/** One shared value per pose number, eased to the new pose on every state change. */
function usePose(state: MascotState, reduceMotion: boolean, ms: number): PoseValues {
  const values = {} as PoseValues;
  // POSE_KEYS is a module constant, so these hooks run in the same order every render.
  for (const key of POSE_KEYS) values[key] = useSharedValue(POSES[state][key]);

  useEffect(() => {
    const pose = POSES[state];
    for (const key of POSE_KEYS) {
      values[key].value = reduceMotion
        ? pose[key]
        : withTiming(pose[key], { duration: ms, easing: ease.inOut });
    }
    // `values` holds the same shared values on every render.
  }, [state, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  return values;
}

/* ------------------------------------------------------------- component */

/** The droplet silhouette, shared by every pose, in a 100-unit box. */
const DROPLET_SVG =
  'M50 6 C50 6 82 42 82 62 C82 80 68 92 50 92 C32 92 18 80 18 62 C18 42 50 6 50 6 Z';
const HIGHLIGHT_SVG = 'M34 42 C28 52 27 61 29 69 C22 62 24 50 34 42 Z';

const TOP = 6;
const BOTTOM = 92;
/** Overshoot so a full droplet's wave crests sit above the tip. */
const SPAN = BOTTOM - TOP + 5;

const DROPLET = Skia.Path.MakeFromSVGString(DROPLET_SVG)!;
const HIGHLIGHT = Skia.Path.MakeFromSVGString(HIGHLIGHT_SVG)!;

interface MascotProps {
  state?: MascotState;
  size?: number;
  reduceMotion?: boolean;
  /**
   * Water level in [0, 1]. Omit for a full droplet (onboarding, where the
   * character is not standing in for progress).
   */
  fill?: number;
  /**
   * Bump this number when the mascot is tapped. Each tap plays the next
   * reaction in `TAP_REACTIONS` for a moment — giggle, wink, surprise, love.
   */
  pokeKey?: number;
}

export function Mascot({ state = 'idle', size = 120, reduceMotion = false, fill, pokeKey = 0 }: MascotProps) {
  const [tap, setTap] = useState<TapReaction | null>(null);
  // A tap reaction briefly takes over the face and body, then hands back.
  const shown: MascotState = tap ?? state;
  const pose = usePose(shown, reduceMotion, tap ? 200 : 420);
  const float = useSharedValue(0);
  const hop = useSharedValue(0);
  const squash = useSharedValue(1);
  const tilt = useSharedValue(0);
  /** 1 → 0 once per action: drives the one-shot heart burst. */
  const hearts = useSharedValue(0);

  useEffect(() => {
    if (pokeKey === 0) return;
    setTap(tapReactionFor(pokeKey));
    const timer = setTimeout(() => setTap(null), TAP_MS);
    return () => clearTimeout(timer);
  }, [pokeKey]);

  // Hearts only on an action: a drink, or the "love" tap. Never as decoration.
  useEffect(() => {
    if (shown !== 'drink' && shown !== 'love') return;
    hearts.value = 1;
    hearts.value = withTiming(0, { duration: 1400, easing: ease.out });
  }, [shown, hearts]);

  // Gentle idle float, always on — 08 asks that idle loops stay ignorable.
  useEffect(() => {
    if (reduceMotion) {
      float.value = 0;
      return;
    }
    const slow = state === 'sleepy' || state === 'sad';
    const amp = slow ? 3 : 5;
    const half = slow ? 2200 : 1600;
    float.value = withRepeat(
      withSequence(
        withTiming(-amp, { duration: half, easing: ease.inOut }),
        withTiming(0, { duration: half, easing: ease.inOut }),
      ),
      -1,
      false,
    );
  }, [state, reduceMotion, float]);

  // Body language for each feeling.
  useEffect(() => {
    cancelAnimation(hop);
    cancelAnimation(squash);
    cancelAnimation(tilt);
    if (reduceMotion) {
      hop.value = 0;
      squash.value = 1;
      tilt.value = 0;
      return;
    }
    const t = (value: number, ms: number, easing = ease.inOut) => withTiming(value, { duration: ms, easing });

    switch (shown) {
      case 'giggle':
        // Ticklish: a fast wriggle and bouncy squishes.
        hop.value = withSequence(t(-5, 110, ease.out), t(0, 160));
        squash.value = withSequence(t(0.86, 80), t(1.06, 120), t(0.95, 100), t(1.04, 100), t(0.98, 100), t(1, 160));
        tilt.value = withSequence(withRepeat(withSequence(t(-7, 70), t(7, 70)), 4, false), t(0, 120));
        break;
      case 'wink':
        // A cocky head-tilt and a little hop.
        hop.value = withSequence(t(-7, 140, ease.out), t(0, 220));
        squash.value = withSequence(t(0.93, 90), t(1.03, 160), t(1, 200));
        tilt.value = withSequence(t(9, 180, ease.out), withDelay(700, t(0, 280)));
        break;
      case 'surprised':
        // Jumps out of its skin, then settles.
        hop.value = withSequence(t(-22, 130, ease.out), t(0, 320));
        squash.value = withSequence(t(1.14, 130), t(0.9, 120), t(1.02, 140), t(1, 160));
        tilt.value = withSequence(t(-3, 130), t(0, 300));
        break;
      case 'love':
        // A dreamy sway.
        hop.value = withSequence(t(-4, 300, ease.out), t(0, 400));
        squash.value = withSequence(t(1.05, 220), t(0.98, 220), t(1, 240));
        tilt.value = withSequence(withRepeat(withSequence(t(-6, 280), t(6, 280)), 2, true), t(0, 220));
        break;
      case 'happy':
        // Two joyful hops with squash & stretch, then a happy sway.
        hop.value = withSequence(t(-18, 170, ease.out), t(0, 200), t(-9, 140, ease.out), t(0, 180));
        squash.value = withSequence(t(0.88, 90), t(1.08, 170), t(0.94, 130), t(1.04, 140), t(1, 220));
        tilt.value = withSequence(
          withDelay(620, withRepeat(withSequence(t(-5, 260), t(5, 260)), 3, true)),
          t(0, 240),
        );
        break;
      case 'drink':
        // Glug, glug, glug.
        hop.value = t(0, 200);
        tilt.value = t(-4, 200);
        squash.value = withRepeat(withSequence(t(0.94, 150), t(1.03, 170)), 3, false);
        break;
      case 'excited':
        hop.value = withRepeat(withSequence(t(-8, 190, ease.out), t(0, 190)), -1, false);
        squash.value = withRepeat(withSequence(t(1.04, 190), t(0.96, 190)), -1, false);
        tilt.value = withRepeat(withSequence(t(-4, 190), t(4, 190)), -1, true);
        break;
      case 'celebrating':
        // Crouch → leap with a spin-wiggle → land → breathe → again.
        hop.value = withRepeat(withSequence(t(4, 160), t(-32, 280, ease.out), t(0, 260), t(0, 700)), -1, false);
        squash.value = withRepeat(
          withSequence(t(0.84, 160), t(1.12, 280), t(0.88, 120), t(1, 200), t(1, 640)),
          -1,
          false,
        );
        tilt.value = withRepeat(withSequence(t(-12, 280), t(12, 280), t(0, 200), t(0, 640)), -1, false);
        break;
      case 'proud':
        // Content — an occasional little hop.
        hop.value = withRepeat(withSequence(t(0, 3000), t(-10, 180, ease.out), t(0, 240)), -1, false);
        squash.value = withRepeat(withSequence(t(1, 3000), t(1.06, 180), t(0.96, 120), t(1, 120)), -1, false);
        tilt.value = t(0, 300);
        break;
      case 'thirsty':
        // A dry little shiver now and then.
        hop.value = t(2, 400);
        squash.value = t(0.97, 400);
        tilt.value = withRepeat(
          withSequence(t(0, 1900), t(-3, 60), t(3, 60), t(-2.5, 60), t(2.5, 60), t(0, 60)),
          -1,
          false,
        );
        break;
      case 'sad':
        hop.value = t(4, 600);
        squash.value = t(0.94, 600);
        tilt.value = withRepeat(withSequence(t(3, 1600), t(7, 1600)), -1, true);
        break;
      case 'sleepy':
        hop.value = t(2, 500);
        tilt.value = t(9, 700);
        squash.value = withRepeat(withSequence(t(1.035, 2200), t(0.98, 2200)), -1, true);
        break;
      case 'thinking':
        hop.value = t(0, 300);
        squash.value = t(1, 300);
        tilt.value = withRepeat(withSequence(t(-10, 1100), t(-5, 1100)), -1, true);
        break;
      default:
        // Idle: breathe.
        hop.value = t(0, 300);
        tilt.value = t(0, 300);
        squash.value = withRepeat(withSequence(t(1.025, 1600), t(0.99, 1600)), -1, true);
    }
  }, [shown, reduceMotion, hop, squash, tilt]);

  const style = useAnimatedStyle(() => ({
    transform: [
      // Squash anchors at the bottom of the droplet, not its centre.
      { translateY: float.value + hop.value + (1 - squash.value) * size * 0.42 },
      { rotateZ: `${tilt.value}deg` },
      { scaleY: squash.value },
      { scaleX: 2 - squash.value },
    ],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Body size={size} fill={fill ?? 1} solid={fill === undefined} reduceMotion={reduceMotion} pose={pose} hearts={hearts} />
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ body */

function Body({
  size,
  fill,
  solid,
  reduceMotion,
  pose,
  hearts,
}: {
  size: number;
  fill: number;
  solid: boolean;
  reduceMotion: boolean;
  pose: PoseValues;
  hearts: SharedValue<number>;
}) {
  const clock = useClock();
  const level = useSharedValue(solid ? 1 : 0);
  const slosh = useSharedValue(0);
  const blink = useSharedValue(0);
  const clamped = Math.max(0, Math.min(fill, 1));
  const motion = reduceMotion ? 0 : 1;

  // Water level spring + a slosh burst every time it moves.
  useEffect(() => {
    if (reduceMotion) {
      level.value = clamped;
      slosh.value = 0;
      return;
    }
    level.value = withSpring(clamped, spring.water);
    slosh.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 1300, easing: ease.out }));
  }, [clamped, reduceMotion, level, slosh]);

  // Blink every few seconds, sometimes twice.
  useEffect(() => {
    if (reduceMotion) {
      blink.value = 0;
      return;
    }
    const once = () => withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 110 }));
    blink.value = withRepeat(
      withSequence(withDelay(2600, once()), withDelay(3400, once()), withDelay(140, once())),
      -1,
      false,
    );
  }, [reduceMotion, blink]);

  const surfaceY = useDerivedValue(() => BOTTOM - level.value * SPAN);
  const waveInput = { clock, surfaceY, level, slosh, motion };
  const backWave = useWave(waveInput, Math.PI, 1.7, 2.4);
  const frontWave = useWave(waveInput, 0, 2.4, 2.8);

  const below = useDerivedValue(() => rect(0, surfaceY.value, 100, 100));
  const above = useDerivedValue(() => rect(0, -10, 100, surfaceY.value + 10));

  const tint = useDerivedValue(() => pose.tint.value);
  const glowLime = useDerivedValue(() => 0.45 * pose.glow.value);

  const transform = useMemo(() => [{ scale: size / 100 }], [size]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={transform}>
        {/* Glow: teal at rest, lime when joyful. */}
        <Path path={DROPLET} color={palette.teal500} opacity={0.3}>
          <BlurMask blur={7} style="normal" />
        </Path>
        <Path path={DROPLET} color={palette.lime400} opacity={glowLime}>
          <BlurMask blur={10} style="normal" />
        </Path>

        <Group clip={DROPLET}>
          {/* Empty glass body. */}
          <Path path={DROPLET}>
            <LinearGradient start={vec(20, 6)} end={vec(80, 92)} colors={[palette.ink600, palette.ink800]} />
          </Path>

          {/* Liquid. */}
          <Path path={backWave} opacity={0.55}>
            <LinearGradient start={vec(0, 20)} end={vec(0, 100)} colors={[palette.lavender400, palette.lavender600]} />
          </Path>
          <Path path={frontWave}>
            <LinearGradient
              start={vec(0, 10)}
              end={vec(0, 96)}
              colors={[palette.teal300, palette.teal500, palette.lavender500]}
            />
          </Path>

          <Bubbles clock={clock} surfaceY={surfaceY} level={level} motion={motion} />

          {/* Mood wash — thirsty and sad look a little dimmer. */}
          <Path path={DROPLET} color={palette.ink950} opacity={tint} />

          {/* Face: dark ink under water, light ink above it. */}
          <Group clip={below}>
            <Face pose={pose} blink={blink} ink={palette.ink950} />
          </Group>
          <Group clip={above}>
            <Face pose={pose} blink={blink} ink={palette.text50} />
          </Group>

          <Path path={HIGHLIGHT} color={palette.white} opacity={0.28} />
        </Group>

        {/* Rim. */}
        <Path path={DROPLET} style="stroke" strokeWidth={2.2}>
          <LinearGradient start={vec(20, 6)} end={vec(82, 92)} colors={[palette.teal300, palette.lavender400]} />
        </Path>

        <Effects pose={pose} clock={clock} motion={motion} hearts={hearts} />
      </Group>
    </Canvas>
  );
}

/**
 * One surface wave: a sine across the droplet at the current water level. Its
 * height grows with the slosh after every change, calms when the droplet is
 * brimming, and disappears on an empty droplet.
 */
function useWave(
  input: {
    clock: SharedValue<number>;
    surfaceY: SharedValue<number>;
    level: SharedValue<number>;
    slosh: SharedValue<number>;
    motion: number;
  },
  offset: number,
  speed: number,
  amp: number,
) {
  const { clock, surfaceY, level, slosh, motion } = input;
  return usePathValue((builder) => {
    'worklet';
    const t = (clock.value / 1000) * speed * motion;
    const y0 = surfaceY.value;
    const presence = Math.min(level.value * 10, 1);
    const a = amp * presence * (1 + 2 * slosh.value) * (level.value > 0.97 ? 0.5 : 1);
    builder.moveTo(0, y0);
    for (let x = 0; x <= 100; x += 4) {
      builder.lineTo(x, y0 + a * Math.sin((x / 100) * Math.PI * 2 * 1.4 + t + offset));
    }
    builder.lineTo(100, 100);
    builder.lineTo(0, 100);
    builder.close();
  });
}

/* ------------------------------------------------------------------ face */

function eye(b: SkPathBuilder, cx: number, cy: number, w: number, top: number, bottom: number) {
  'worklet';
  const k = 1.33;
  b.moveTo(cx - w, cy);
  b.cubicTo(cx - w, cy - top * k, cx + w, cy - top * k, cx + w, cy);
  b.cubicTo(cx + w, cy + bottom * k, cx - w, cy + bottom * k, cx - w, cy);
  b.close();
}

function Face({ pose, blink, ink }: { pose: PoseValues; blink: SharedValue<number>; ink: string }) {
  const eyes = usePathValue((b) => {
    'worklet';
    const open = 1 - 0.85 * blink.value;
    const w = 4.2 * pose.eyeScale.value;
    const top = pose.eyeTop.value * open;
    const bottom = pose.eyeBottom.value * open;
    const x = pose.lookX.value;
    const y = 58 + pose.lookY.value;
    eye(b, 40 + x, y, w, top, bottom);
    const k = pose.wink.value;
    eye(b, 60 + x, y, w, top + (2 - top) * k, bottom + (-1.6 - bottom) * k);
  });

  const shines = usePathValue((b) => {
    'worklet';
    const x = pose.lookX.value;
    const y = 58 + pose.lookY.value - pose.eyeTop.value * 0.45;
    const r = 1.5 * pose.eyeScale.value;
    b.addCircle(41.8 + x, y, r);
    if (pose.wink.value < 0.5) b.addCircle(61.8 + x, y, r);
  });
  // Shines only on round, open eyes.
  const shineOpacity = useDerivedValue(
    () => Math.max(0, Math.min((pose.eyeBottom.value - 1.2) / 3, 1)) * (1 - blink.value),
  );

  const mouth = usePathValue((b) => {
    'worklet';
    const w = pose.mouthWidth.value;
    const c = pose.mouthCurve.value;
    const o = pose.mouthOpen.value;
    const y = 72;
    b.moveTo(50 - w, y - c * 0.2);
    b.quadTo(50, y + c * (1 - o * 0.55), 50 + w, y - c * 0.2);
    b.quadTo(50, y + c + o * 10, 50 - w, y - c * 0.2);
    b.close();
  });

  // A little tongue shows when the mouth opens wide.
  const tongue = useDerivedValue(() => {
    const o = pose.mouthOpen.value;
    const c = pose.mouthCurve.value;
    const w = pose.mouthWidth.value * 0.55;
    return rect(50 - w, 72 + c + o * 10 - 4.5 * o - 1, w * 2, 6);
  });
  const tongueOpacity = useDerivedValue(() => Math.max(0, Math.min((pose.mouthOpen.value - 0.3) / 0.4, 1)));

  const brows = usePathValue((b) => {
    'worklet';
    const v = pose.brow.value;
    const up = Math.max(v, 0);
    const down = Math.min(v, 0);
    const x = pose.lookX.value * 0.5;
    b.moveTo(34.5 + x, 48.5 - up * 2);
    b.lineTo(44 + x, 48.5 - up * 2.8 + down * 2.8);
    b.moveTo(56 + x, 48.5 - up * 2.8 + down * 2.8);
    b.lineTo(65.5 + x, 48.5 - up * 2);
  });
  const browOpacity = useDerivedValue(() => pose.browAlpha.value);
  const blushOpacity = useDerivedValue(() => pose.blush.value * 0.6);

  return (
    <Group>
      <Oval rect={rect(25.5, 64, 10, 5.5)} color={palette.pink400} opacity={blushOpacity} />
      <Oval rect={rect(64.5, 64, 10, 5.5)} color={palette.pink400} opacity={blushOpacity} />
      <Path path={eyes} color={ink} />
      <Path path={shines} color={palette.white} opacity={shineOpacity} />
      <Path path={brows} style="stroke" strokeWidth={2.2} strokeCap="round" color={ink} opacity={browOpacity} />
      <Path path={mouth} color={ink} />
      <Group clip={mouth}>
        <Oval rect={tongue} color={palette.pink500} opacity={tongueOpacity} />
      </Group>
      <Path path={mouth} style="stroke" strokeWidth={2.6} strokeCap="round" strokeJoin="round" color={ink} />
    </Group>
  );
}

/* --------------------------------------------------------------- effects */

type EffectProps = { pose: PoseValues; clock: SharedValue<number>; motion: number };

function Effects({ pose, clock, motion, hearts }: EffectProps & { hearts: SharedValue<number> }) {
  return (
    <>
      <Tear pose={pose} clock={clock} motion={motion} />
      <Sweat pose={pose} clock={clock} motion={motion} />
      <Zee index={0} pose={pose} clock={clock} motion={motion} />
      <Zee index={1} pose={pose} clock={clock} motion={motion} />
      <Zee index={2} pose={pose} clock={clock} motion={motion} />
      <Sparkles pose={pose} clock={clock} motion={motion} />
      <Heart index={0} burst={hearts} />
      <Heart index={1} burst={hearts} />
      <Heart index={2} burst={hearts} />
      <ThinkDots pose={pose} clock={clock} motion={motion} />
    </>
  );
}

function drop(b: SkPathBuilder, x: number, y: number, s: number) {
  'worklet';
  b.moveTo(x, y - 3 * s);
  b.quadTo(x + 2.6 * s, y + 0.4 * s, x, y + 1.8 * s);
  b.quadTo(x - 2.6 * s, y + 0.4 * s, x, y - 3 * s);
  b.close();
}

/** Sad: a single small tear rolling down, now and then. */
function Tear({ pose, clock, motion }: EffectProps) {
  const progress = useDerivedValue(() => (motion ? ((clock.value / 1000) * 0.55) % 1 : 0.3));
  const path = usePathValue((b) => {
    'worklet';
    const p = progress.value;
    drop(b, 66 + p * 1.5, 63 + p * 18, 0.9);
  });
  const opacity = useDerivedValue(() => pose.tear.value * (1 - progress.value) * 0.95);
  return <Path path={path} color={palette.teal300} opacity={opacity} />;
}

/** Thirsty: a bead of sweat bobbing at the temple. */
function Sweat({ pose, clock, motion }: EffectProps) {
  const path = usePathValue((b) => {
    'worklet';
    drop(b, 76, 40 + Math.sin((clock.value / 1000) * 3 * motion) * 1.4, 1.2);
  });
  const opacity = useDerivedValue(() => pose.sweat.value);
  return <Path path={path} color={palette.teal300} opacity={opacity} />;
}

/** Sleepy: little z's drifting up and away. */
function Zee({ index, pose, clock, motion }: EffectProps & { index: number }) {
  const p = useDerivedValue(() => ((clock.value / 1000) * 0.32 * motion + index / 3) % 1);
  const path = usePathValue((b) => {
    'worklet';
    const s = 2.6 + p.value * 3;
    const x = 70 + p.value * 12;
    const y = 36 - p.value * 24;
    b.moveTo(x, y);
    b.lineTo(x + s, y);
    b.lineTo(x, y + s);
    b.lineTo(x + s, y + s);
  });
  const opacity = useDerivedValue(() => pose.zzz.value * Math.sin(p.value * Math.PI));
  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={1.8}
      strokeCap="round"
      strokeJoin="round"
      color={palette.lavender300}
      opacity={opacity}
    />
  );
}

function star(b: SkPathBuilder, x: number, y: number, r: number) {
  'worklet';
  if (r <= 0.05) return;
  b.moveTo(x, y - r);
  b.quadTo(x, y, x + r, y);
  b.quadTo(x, y, x, y + r);
  b.quadTo(x, y, x - r, y);
  b.quadTo(x, y, x, y - r);
  b.close();
}

const SPARKS = [
  { x: 10, y: 30, r: 4.5, c: 0 },
  { x: 90, y: 36, r: 3.6, c: 1 },
  { x: 82, y: 12, r: 3, c: 0 },
  { x: 18, y: 12, r: 2.6, c: 1 },
  { x: 94, y: 62, r: 2.4, c: 0 },
  { x: 6, y: 58, r: 2.2, c: 1 },
];

function useStars(colorIndex: number, { pose, clock, motion }: EffectProps) {
  return usePathValue((b) => {
    'worklet';
    const t = (clock.value / 1000) * motion;
    for (let i = 0; i < SPARKS.length; i += 1) {
      const s = SPARKS[i];
      if (s.c !== colorIndex) continue;
      const twinkle = motion ? 0.35 + 0.65 * Math.abs(Math.sin(t * 3 + i * 1.3)) : 1;
      star(b, s.x, s.y, s.r * twinkle * pose.sparkle.value);
    }
  });
}

/** Excited / celebrating / proud: twinkling stars. */
function Sparkles(props: EffectProps) {
  const lime = useStars(0, props);
  const yellow = useStars(1, props);
  const opacity = useDerivedValue(() => Math.min(props.pose.sparkle.value * 1.4, 1));
  return (
    <Group opacity={opacity}>
      <Path path={lime} color={palette.lime400} />
      <Path path={yellow} color={palette.yellow400} />
    </Group>
  );
}

function heart(b: SkPathBuilder, x: number, y: number, s: number) {
  'worklet';
  b.moveTo(x, y + s * 0.9);
  b.cubicTo(x - s * 1.7, y - s * 0.2, x - s * 0.7, y - s * 1.5, x, y - s * 0.45);
  b.cubicTo(x + s * 0.7, y - s * 1.5, x + s * 1.7, y - s * 0.2, x, y + s * 0.9);
  b.close();
}

const HEART_SPOTS = [
  { x: 80, y: 40, delay: 0 },
  { x: 20, y: 44, delay: 0.15 },
  { x: 72, y: 26, delay: 0.3 },
];

/**
 * A heart that floats up once per action (a drink, or the "love" tap) and is
 * gone — `burst` runs 1 → 0, and nothing is drawn while it rests at 0.
 */
function Heart({ index, burst }: { index: number; burst: SharedValue<number> }) {
  const spot = HEART_SPOTS[index];
  const p = useDerivedValue(() => Math.max(0, Math.min((1 - burst.value) * 1.3 - spot.delay, 1)));
  const path = usePathValue((b) => {
    'worklet';
    const x = spot.x + Math.sin(p.value * 6) * 2;
    heart(b, x, spot.y - p.value * 24, 2.2 + p.value * 1.8);
  });
  const opacity = useDerivedValue(() => (burst.value > 0.001 ? Math.sin(p.value * Math.PI) : 0));
  return <Path path={path} color={palette.pink500} opacity={opacity} />;
}

/** Thinking: a little thought trail. */
function ThinkDots({ pose, clock, motion }: EffectProps) {
  const path = usePathValue((b) => {
    'worklet';
    const t = (clock.value / 1000) * motion;
    const pulse = (i: number) => (motion ? 0.75 + 0.25 * Math.sin(t * 4 - i) : 1);
    b.addCircle(74, 40, 1.3 * pulse(0));
    b.addCircle(79.5, 32.5, 1.9 * pulse(1));
    b.addCircle(86.5, 24, 2.7 * pulse(2));
  });
  const opacity = useDerivedValue(() => pose.think.value);
  return <Path path={path} color={palette.text200} opacity={opacity} />;
}

/* ---------------------------------------------------------------- bubbles */

/** Bubbles rising through the water, looping from the bottom to the surface. */
function Bubbles({
  clock,
  surfaceY,
  level,
  motion,
}: {
  clock: SharedValue<number>;
  surfaceY: SharedValue<number>;
  level: SharedValue<number>;
  motion: number;
}) {
  return (
    <>
      {BUBBLES.map((bubble, index) => (
        <Bubble key={index} {...bubble} clock={clock} surfaceY={surfaceY} level={level} motion={motion} />
      ))}
    </>
  );
}

const BUBBLES = [
  { x: 38, r: 1.6, speed: 9, phase: 0 },
  { x: 55, r: 2.2, speed: 7, phase: 0.35 },
  { x: 64, r: 1.3, speed: 11, phase: 0.6 },
  { x: 46, r: 1.1, speed: 13, phase: 0.8 },
];

function Bubble({
  x,
  r,
  speed,
  phase,
  clock,
  surfaceY,
  level,
  motion,
}: {
  x: number;
  r: number;
  speed: number;
  phase: number;
  clock: SharedValue<number>;
  surfaceY: SharedValue<number>;
  level: SharedValue<number>;
  motion: number;
}) {
  const cy = useDerivedValue(() => {
    const depth = Math.max(BOTTOM - 4 - surfaceY.value, 1);
    const travel = (((clock.value / 1000) * speed * motion) / depth + phase) % 1;
    return BOTTOM - 4 - travel * depth;
  });
  const cx = useDerivedValue(() => x + Math.sin(clock.value / 400 + phase * 6) * 1.2 * motion);
  const opacity = useDerivedValue(() => (level.value > 0.08 ? 0.55 : 0));
  return <Circle cx={cx} cy={cy} r={r} color={palette.white} opacity={opacity} />;
}

/* ------------------------------------------------------------------ stage */

/** A soft pedestal so the mascot never floats on nothing. */
export function MascotStage({
  state,
  size = 140,
  reduceMotion,
  fill,
  pokeKey,
}: {
  state?: MascotState;
  size?: number;
  reduceMotion?: boolean;
  fill?: number;
  pokeKey?: number;
}) {
  return (
    <View style={styles.stage}>
      <Mascot state={state} size={size} reduceMotion={reduceMotion} fill={fill} pokeKey={pokeKey} />
      <View style={[styles.shadow, { width: size * 0.46 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
  },
  shadow: {
    height: 8,
    borderRadius: 4,
    marginTop: -6,
    backgroundColor: palette.teal500,
    opacity: 0.18,
  },
});
