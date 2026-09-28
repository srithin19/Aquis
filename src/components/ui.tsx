/**
 * Shared UI primitives — Matiks-style dark.
 *
 * Flat charcoal cards with hairline borders, and chunky "3D" buttons and tiles
 * whose face sits on a darker edge and presses down into it. Motion follows
 * Product Bible 08 and stays at the fast end of its budget: presses land in
 * ~100 ms, everything else uses one no-overshoot ease-out curve.
 */

import React from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { color, duration, EDGE, ease, font, palette, radius, spacing, typography } from '@/theme';
import { haptic } from '@/utils/haptics';

/* ------------------------------------------------------------------ motion */

/** The standard entrance: a short rise + fade on the app's ease-out curve. */
export function enterUp(delay = 0, reduceMotion = false) {
  return reduceMotion ? undefined : FadeInDown.duration(duration.slow).delay(delay).easing(ease.out);
}

/** A soft "arrive": fade in from 94% scale. One motion, no overshoot. */
export function enterPop(delay = 0, reduceMotion = false) {
  if (reduceMotion) return undefined;
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.94 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: ease.out },
  })
    .duration(duration.slow)
    .delay(delay);
}

export function enterFade(delay = 0, reduceMotion = false) {
  return reduceMotion ? undefined : FadeIn.duration(duration.base).delay(delay).easing(ease.out);
}

/* ------------------------------------------------------------------ layout */

export function Screen({
  children,
  scroll = false,
  edges = ['top', 'bottom'],
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
  contentStyle?: ViewProps['style'];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        // One keyboard strategy for every form: the whole scroll view makes
        // room, so inputs low on the page stay visible on iOS and Android.
        <KeyboardAvoidingView style={styles.screenFlex} behavior="padding">
          <ScrollView
            contentContainerStyle={[styles.screenContent, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.screenContent, styles.screenFlex, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Spacer({ size = spacing.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

/** A flat charcoal card. `glow` gives it a lime hairline for emphasis. */
export function Card({
  children,
  style,
  glow = false,
  ...rest
}: ViewProps & { glow?: boolean }) {
  return (
    <View style={[styles.card, glow && styles.cardGlow, style]} {...rest}>
      {children}
    </View>
  );
}

export function Divider({ spaced = true }: { spaced?: boolean }) {
  return <View style={[styles.divider, spaced && styles.dividerSpaced]} />;
}

/* -------------------------------------------------------------------- text */

type TextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'faint'
  | 'accent'
  | 'violet'
  | 'success'
  | 'onAccent';

const TONE: Record<TextTone, string> = {
  primary: color.textPrimary,
  secondary: color.textSecondary,
  muted: color.textMuted,
  faint: color.textFaint,
  accent: color.accent,
  violet: palette.lavender400,
  success: color.success,
  onAccent: color.textOnAccent,
};

interface TypeProps extends TextProps {
  tone?: TextTone;
  center?: boolean;
}

function makeText(variant: keyof typeof typography) {
  return function Typed({ style, tone = 'primary', center, ...rest }: TypeProps) {
    return (
      <Text
        style={[
          typography[variant] as TextProps['style'],
          { color: TONE[tone] },
          center && styles.center,
          style,
        ]}
        {...rest}
      />
    );
  };
}

export const Hero = makeText('hero');
export const Display = makeText('display');
export const Title = makeText('title');
export const Heading = makeText('heading');
export const Body = makeText('body');
export const BodyStrong = makeText('bodyStrong');
export const Caption = makeText('caption');
export const Micro = makeText('micro');

/** Uppercase section label. */
export function SectionLabel({ children, style }: { children: string; style?: TextProps['style'] }) {
  return (
    <Micro tone="muted" style={[styles.sectionLabel, style]}>
      {children.toUpperCase()}
    </Micro>
  );
}

/* ---------------------------------------------------------------- 3D press */

/**
 * The Matiks tile: a coloured face sitting on a darker edge. Pressing pushes
 * the face down into the edge; releasing lets it back up. Used by buttons and
 * the Home quick-add tiles.
 */
export function PressTile({
  face,
  edge,
  children,
  onPress,
  disabled,
  style,
  faceStyle,
  accessibilityLabel,
  hapticOnPress = true,
}: {
  face: string;
  edge: string;
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  faceStyle?: ViewStyle;
  accessibilityLabel?: string;
  hapticOnPress?: boolean;
}) {
  const depth = useSharedValue(0);
  const faceAnim = useAnimatedStyle(() => ({ transform: [{ translateY: depth.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={() => {
        depth.value = withTiming(EDGE - 1, { duration: duration.instant });
      }}
      onPressOut={() => {
        depth.value = withTiming(0, { duration: duration.quick, easing: ease.out });
      }}
      onPress={() => {
        if (hapticOnPress) haptic('light');
        onPress?.();
      }}
      style={[styles.tileOuter, { backgroundColor: edge }, disabled && styles.buttonDisabled, style]}
    >
      <Animated.View style={[styles.tileFace, { backgroundColor: face }, faceStyle, faceAnim]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* ----------------------------------------------------------------- buttons */

interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  fullWidth?: boolean;
  hapticOnPress?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Button({
  label,
  variant = 'primary',
  fullWidth = true,
  hapticOnPress = true,
  disabled,
  onPress,
  style,
}: ButtonProps) {
  const lastPress = React.useRef(0);
  const press = () => {
    const now = Date.now();
    if (now - lastPress.current < 600) return;
    lastPress.current = now;
    onPress?.();
  };

  if (variant === 'ghost') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => {
          if (hapticOnPress) haptic('light');
          press();
        }}
        style={({ pressed }) => [
          styles.ghost,
          fullWidth && styles.buttonFull,
          pressed && styles.pressed,
          disabled && styles.buttonDisabled,
          style,
        ]}
      >
        <Text style={[styles.buttonLabel, styles.labelGhost]}>{label}</Text>
      </Pressable>
    );
  }

  const primary = variant === 'primary';
  return (
    <PressTile
      face={primary ? palette.lime400 : palette.ink700}
      edge={primary ? palette.lime700 : palette.ink950}
      disabled={disabled}
      hapticOnPress={hapticOnPress}
      onPress={press}
      accessibilityLabel={label}
      style={{ ...(fullWidth ? styles.buttonFull : {}), ...style }}
      faceStyle={{ ...styles.buttonFace, ...(primary ? {} : styles.buttonFaceSecondary) }}
    >
      <Text style={[styles.buttonLabel, primary ? styles.labelPrimary : styles.labelSecondary]}>
        {label}
      </Text>
    </PressTile>
  );
}

/**
 * Selection card used by goal setup and duration (06.4, 06.5).
 * "Selected card rises" — here it lifts off its edge and lights up lime.
 */
export function OptionCard({
  title,
  subtitle,
  selected,
  onPress,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const lift = useSharedValue(selected ? 1 : 0);

  React.useEffect(() => {
    lift.value = withTiming(selected ? 1 : 0, { duration: duration.base, easing: ease.out });
  }, [selected, lift]);

  const faceAnim = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 2 }] }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={[styles.optionWrap, { backgroundColor: selected ? palette.lime700 : palette.ink950 }]}
    >
      <Animated.View
        style={[
          styles.option,
          compact && styles.optionCompact,
          selected && styles.optionSelected,
          faceAnim,
        ]}
      >
        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.optionSubtitle, selected && styles.optionSubtitleSelected]}>{subtitle}</Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/** A selectable pill. */
export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

/** A quiet inline notice — used for validation and empty states. */
export function Notice({ text, tone = 'muted' }: { text: string; tone?: TextTone }) {
  return (
    <Animated.View key={text} entering={FadeIn.duration(duration.quick)} style={styles.notice}>
      <Caption tone={tone} center>
        {text}
      </Caption>
    </Animated.View>
  );
}

/** Fades its children in on mount — used for staggered screen entrances. */
export function FadeInView({
  children,
  delay = 0,
  reduceMotion = false,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  reduceMotion?: boolean;
  style?: ViewProps['style'];
}) {
  return (
    <Animated.View entering={enterUp(delay, reduceMotion)} style={style}>
      {children}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ styles */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  screenContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  screenFlex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: color.border,
  },
  cardGlow: {
    borderColor: color.accentSoft,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.borderStrong,
  },
  dividerSpaced: {
    marginVertical: spacing.md,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  tileOuter: {
    borderRadius: radius.lg,
    paddingBottom: EDGE,
  },
  tileFace: {
    borderRadius: radius.lg,
  },
  buttonFace: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonFaceSecondary: {
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  buttonFull: {
    alignSelf: 'stretch',
  },
  ghost: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.6,
  },
  buttonLabel: {
    fontFamily: font.bodyBold,
    fontSize: 15,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  labelPrimary: {
    color: color.textOnAccent,
  },
  labelSecondary: {
    color: color.textPrimary,
  },
  labelGhost: {
    color: color.accent,
    textTransform: 'none',
    letterSpacing: 0.2,
    fontFamily: font.bodyStrong,
  },
  optionWrap: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: radius.lg,
    paddingBottom: EDGE,
  },
  option: {
    minHeight: 88,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  optionCompact: {
    minHeight: 68,
  },
  optionSelected: {
    borderColor: palette.lime400,
    backgroundColor: '#1F2616',
  },
  optionTitle: {
    ...typography.heading,
    color: color.textPrimary,
  },
  optionTitleSelected: {
    color: palette.lime400,
  },
  optionSubtitle: {
    ...typography.caption,
    color: color.textMuted,
    marginTop: spacing.xs,
  },
  optionSubtitleSelected: {
    color: color.textSecondary,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  chipSelected: {
    borderColor: color.accent,
    backgroundColor: color.accentWash,
  },
  chipLabel: {
    ...typography.caption,
    color: color.textSecondary,
  },
  chipLabelSelected: {
    color: color.accent,
  },
  notice: {
    paddingHorizontal: spacing.md,
  },
});
