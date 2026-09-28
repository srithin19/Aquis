/**
 * AQUIS design tokens — Matiks-style dark.
 *
 * Flat charcoal grounds, near-black cards with hairline borders, and a small
 * set of loud accents: neon lime for action and success, lavender and pastel
 * pink/yellow for play, and teal for the water itself. Values were sampled
 * from Matiks' own screenshots.
 *
 * Section 06.12 still applies: no aggressive red failure states anywhere —
 * "missed" is a dim, not an alarm.
 */

import { Easing } from 'react-native-reanimated';

export const palette = {
  // Charcoal grounds, darkest first.
  ink950: '#0E0E0E',
  ink900: '#141414',
  ink800: '#1C1C1C',
  ink700: '#242424',
  ink600: '#2C2C2C',
  ink500: '#383838',

  // Neon lime — primary action, progress, success.
  lime300: '#D4FFA0',
  lime400: '#B2F966',
  lime500: '#96DE48',
  lime700: '#5C8A26',

  // Lavender — the Matiks tile colour.
  lavender300: '#CFC5FF',
  lavender400: '#B3A3FB',
  lavender500: '#9D8CF2',
  lavender600: '#7F6ED6',

  // Pastels.
  pink400: '#F9CADB',
  pink500: '#EEA0C0',
  yellow400: '#F2E2A2',
  yellow600: '#C9B66E',
  orange400: '#EBB36B',

  // Water.
  teal300: '#9BF1F4',
  teal400: '#5CE1E6',
  teal500: '#2FC6CF',
  teal600: '#1E9AA3',

  coral400: '#F28B82',

  // Text on charcoal.
  text50: '#FAFAFA',
  text200: '#C8C8C8',
  text400: '#8E8E8E',
  text600: '#5C5C5C',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export const color = {
  background: palette.ink900,
  backgroundDeep: palette.ink950,
  surface: palette.ink800,
  surfaceStrong: palette.ink700,
  surfaceSunk: palette.ink950,
  surfaceSolid: palette.ink800,
  border: palette.ink600,
  borderStrong: palette.ink500,

  textPrimary: palette.text50,
  textSecondary: palette.text200,
  textMuted: palette.text400,
  textFaint: palette.text600,
  textOnAccent: palette.ink950,

  accent: palette.lime400,
  accentStrong: palette.lime300,
  accentEdge: palette.lime700,
  accentSoft: 'rgba(178,249,102,0.35)',
  accentWash: 'rgba(178,249,102,0.10)',
  violet: palette.lavender400,
  violetWash: 'rgba(179,163,251,0.14)',
  magenta: palette.pink400,

  waterTop: palette.teal300,
  waterBody: palette.teal400,
  waterDeep: palette.lavender500,

  success: palette.lime400,
  successWash: 'rgba(178,249,102,0.12)',
  warning: palette.orange400,
  danger: palette.coral400,
} as const;

/** Gradient stops, always listed start → end. Used sparingly: water and badges. */
export const gradient = {
  water: [palette.teal300, palette.teal500, palette.lavender500] as const,
  primary: [palette.lime400, palette.lime500] as const,
  success: [palette.lime300, palette.lime400] as const,
  warm: [palette.orange400, palette.pink500] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Font families, loaded in `app/_layout.tsx`. Numbers and headlines use Space
 * Grotesk; running text uses Inter. Custom families carry their own weight, so
 * no `fontWeight` is set alongside them (Android ignores it otherwise).
 */
export const font = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodyStrong: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const typography = {
  hero: { fontFamily: font.display, fontSize: 56, lineHeight: 60, letterSpacing: -1.5 },
  display: { fontFamily: font.display, fontSize: 36, lineHeight: 42, letterSpacing: -0.8 },
  title: { fontFamily: font.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  heading: { fontFamily: font.displayMedium, fontSize: 21, lineHeight: 27, letterSpacing: -0.2 },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: font.bodyStrong, fontSize: 16, lineHeight: 23 },
  caption: { fontFamily: font.bodyMedium, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: font.bodyBold, fontSize: 11, lineHeight: 15, letterSpacing: 1 },
} as const;

export const elevation = {
  card: {
    shadowColor: palette.black,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  raised: {
    shadowColor: palette.black,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
} as const;

/** Depth of the Matiks-style 3D edge under buttons and tiles. */
export const EDGE = 4;

/**
 * Motion budget, Product Bible 08: micro-interactions land in 150–500 ms,
 * celebrations may run 1–2 s, idle loops stay ignorable. Everything here sits
 * at the fast end — the app should feel instant.
 */
export const duration = {
  instant: 100,
  quick: 160,
  base: 240,
  slow: 360,
  celebration: 1400,
  idleLoop: 3200,
} as const;

/**
 * One easing curve for the whole app: a fast start and a long, soft landing
 * (an "expo-out" feel). No overshoot, so nothing wobbles.
 */
export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
} as const;

export const spring = {
  /** Button press, 0.97 -> 1.0 per the animation table. Critically damped. */
  press: { damping: 22, stiffness: 420, mass: 0.6 },
  /** Card lift on selection. */
  card: { damping: 22, stiffness: 260, mass: 0.8 },
  /** Water level — liquid but settled quickly, no visible wobble. */
  water: { damping: 20, stiffness: 140, mass: 1 },
  /** A single soft pop. Barely overshoots, never bounces twice. */
  pop: { damping: 18, stiffness: 300, mass: 0.7 },
} as const;
