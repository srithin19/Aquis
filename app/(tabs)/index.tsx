/**
 * Home — Product Bible 06.9 / 06.11, the primary daily interaction.
 *
 * The droplet *is* the glass, and it has feelings. Logging raises the liquid,
 * the halo sweeps round, a "+250 ml" floats up, the mascot gulps and then
 * beams (or gets excited near the finish), its speech bubble chimes in, the
 * number counts up and a haptic fires — the section 08 sequence in one tap.
 * Crossing 25/50/75% earns a shout-out; reaching 100% throws a party.
 *
 * Reactions are driven by the data, not by the button, so a drink logged from
 * the custom sheet or straight from a notification gets the same response.
 * Levels come straight from the stored daily total, so "the visual glass
 * always matches the stored daily total" (20) holds by construction.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeOut,
  FadeOutLeft,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Celebration } from '@/components/Celebration';
import { Confetti } from '@/components/Confetti';
import { useCountUp } from '@/components/CountUp';
import { Icon } from '@/components/Icon';
import { useTabBarInset } from '@/components/layout';
import { Mascot, tapReactionFor, type MascotState } from '@/components/Mascot';
import { ProgressRing } from '@/components/ProgressRing';
import {
  Body,
  BodyStrong,
  Button,
  Caption,
  Card,
  enterPop,
  enterUp,
  PressTile,
  Hero,
  Micro,
  SectionLabel,
  Title,
} from '@/components/ui';
import { formatDayLabel, formatTime, greetingFor } from '@/domain/date';
import { formatMl, formatVolume, remainingMl } from '@/domain/hydration';
import {
  crossedMilestone,
  mascotLine,
  milestoneLine,
  selectMascotState,
  tapLine,
  type Reaction,
} from '@/domain/mascot';
import type { WaterEntry } from '@/domain/types';
import { useAppState } from '@/state/AppProvider';
import { color, duration, ease, font, gradient, palette, radius, spacing } from '@/theme';
import { play } from '@/services/sound';
import { haptic } from '@/utils/haptics';

/** The gulp, then the grin. */
const DRINK_MS = 750;
const REACTION_MS = 2600;
/** How long the goal party lasts before the mascot settles into "proud". */
const PARTY_MS = 3800;
const SHOUT_MS = 3200;
const RING_SIZE = 300;
const MASCOT_SIZE = 206;

function sinceLabel(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60 ? `${minutes % 60} min ` : ''}ago`;
}

export default function HomeScreen() {
  const {
    activeGoal,
    consumedMl,
    goalMl,
    progress,
    goalReached,
    goalDay,
    today,
    entries,
    settings,
    profile,
    streak,
    nextReminderAt,
    notificationPermission,
    goalSummary,
    reduceMotion,
    logWater,
    removeEntry,
    refresh,
  } = useAppState();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();

  const [reaction, setReaction] = useState<Reaction>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [floats, setFloats] = useState<{ id: string; amount: number }[]>([]);
  const [rippleKey, setRippleKey] = useState(0);
  const [pokeKey, setPokeKey] = useState(0);
  const [lineSeed, setLineSeed] = useState(0);
  const [shout, setShout] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const busyRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // A clock for "last sip 12 min ago" and time-of-day moods.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // A goal period that ended while the app was open (04 goal-end flow). Keyed
  // on the goal id: a refresh rebuilds the summary object, and that must not
  // push a second copy of the screen.
  const summaryShownFor = useRef<string | null>(null);
  const summaryGoalId = goalSummary?.goal.id ?? null;
  useEffect(() => {
    if (!summaryGoalId || summaryShownFor.current === summaryGoalId) return;
    summaryShownFor.current = summaryGoalId;
    router.push('/goal-summary');
  }, [summaryGoalId]);

  const showShout = useCallback(
    (text: string, ms: number = SHOUT_MS) => {
      setShout(text);
      later(() => setShout((current) => (current === text ? null : current)), ms);
    },
    [later],
  );

  /**
   * React to what the data did: a new drink (from anywhere), a milestone, the
   * goal completing, or midnight turning the page.
   */
  const previous = useRef({ today, count: entries.length, progress, goalReached });
  useEffect(() => {
    const before = previous.current;
    previous.current = { today, count: entries.length, progress, goalReached };

    if (before.today !== today) {
      // 12 AM: yesterday is saved in History, the glass starts empty.
      setReaction(null);
      setCelebrating(false);
      showShout('New day, fresh glass! ☀️');
      return;
    }

    if (entries.length > before.count) {
      const newest = entries[entries.length - 1];
      setFloats((current) => [...current, { id: newest.id, amount: newest.amountMl }]);
      setRippleKey((k) => k + 1);
      if (!(goalReached && !before.goalReached)) play('drop');
      setReaction('drink');
      later(() => setReaction((r) => (r === 'drink' ? 'happy' : r)), DRINK_MS);
      later(() => setReaction((r) => (r === 'happy' ? null : r)), REACTION_MS);

      const mark = crossedMilestone(before.progress, progress);
      if (mark !== null && !goalReached) {
        haptic('medium');
        // Let the drop land first, then the chime.
        later(() => play('chime'), 220);
        showShout(milestoneLine(mark));
      }
    }

    if (goalReached && !before.goalReached) {
      // 06.11 — the party. Strong haptic only here (08).
      haptic('success');
      play('celebrate');
      setReaction(null);
      setCelebrating(true);
      later(() => setCelebrating(false), PARTY_MS);
    }
  }, [today, entries, progress, goalReached, later, showShout]);

  const lastEntryAt = entries.length > 0 ? entries[entries.length - 1].loggedAt : null;

  const mascotState: MascotState = useMemo(
    () => selectMascotState({ goalReached, celebrating, reaction, progress, lastEntryAt, now }),
    [goalReached, celebrating, reaction, progress, lastEntryAt, now],
  );

  const left = remainingMl(consumedMl, goalMl);
  const line =
    shout ??
    mascotLine({
      state: mascotState,
      progress,
      remainingLabel: formatVolume(left),
      entryCount: entries.length,
      hour: new Date(now).getHours(),
      seed: lineSeed,
    });

  const displayedMl = useCountUp({ value: consumedMl, immediate: reduceMotion, durationMs: 420 });
  const displayedPercent = useCountUp({
    value: Math.round(progress * 100),
    immediate: reduceMotion,
    durationMs: 420,
  });

  const handleLog = useCallback(
    async (amountMl: number) => {
      // A ref, not state: rapid taps must not double-log before a re-render.
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const outcome = await logWater(amountMl, 'quick_add');
        // 08 — light on logging; the goal party fires its own success haptic.
        if (!outcome.justCompleted) haptic('light');
      } finally {
        busyRef.current = false;
      }
    },
    [logWater],
  );

  // Tap the droplet: it giggles, winks, jumps or blushes — and says so.
  const handlePoke = useCallback(() => {
    haptic('light');
    play('pop');
    const next = pokeKey + 1;
    setPokeKey(next);
    setLineSeed((s) => s + 1);
    showShout(tapLine(tapReactionFor(next), next), 2200);
  }, [pokeKey, showShout]);

  const handleSubtractEntry = useCallback(
    async (entry: WaterEntry) => {
      haptic('light');
      play('undo');
      setReaction(null);
      await removeEntry(entry.id);
    },
    [removeEntry],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Newest first: the entry you most likely want to subtract sits at the top.
  const timeline = useMemo(() => entries.slice().reverse(), [entries]);

  const reminderLine = !settings.notificationsEnabled
    ? 'Reminders are off'
    : notificationPermission === 'denied'
      ? 'Notifications are blocked in system settings'
      : goalReached && !settings.postGoalRemindersEnabled
        ? 'Quiet for the rest of today'
        : nextReminderAt
          ? `Next nudge around ${formatTime(nextReminderAt)}`
          : 'No nudges planned right now';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.accent} />
        }
      >
        {/* Header — greeting, date, goal day, streak (06.9). */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Caption tone="muted">{formatDayLabel(today)}</Caption>
            <Title numberOfLines={1}>
              {greetingFor(new Date(now))}
              {profile?.displayName ? `, ${profile.displayName}` : ''}
            </Title>
          </View>
          <View style={styles.headerChips}>
            {/* Re-keyed on change, so a growing streak pops. */}
            <Animated.View
              key={`streak-${streak.current}`}
              entering={enterPop(0, reduceMotion)}
              style={[styles.chip, streak.current > 0 && styles.chipWarm]}
            >
              <Icon name="flame" size={15} color={streak.current > 0 ? palette.orange400 : color.textMuted} />
              <Micro tone={streak.current > 0 ? 'primary' : 'muted'}>{streak.current}</Micro>
            </Animated.View>
            {activeGoal ? (
              <View style={styles.chip}>
                <Micro tone="accent">
                  DAY {goalDay}/{activeGoal.durationDays}
                </Micro>
              </View>
            ) : null}
          </View>
        </View>

        {/* The mascot's speech bubble. Tap the droplet for another line. */}
        <View style={styles.bubbleRow}>
          <Animated.View key={line} entering={enterPop(0, reduceMotion)} style={styles.bubble}>
            <BodyStrong style={styles.bubbleText} numberOfLines={2}>
              {line}
            </BodyStrong>
            <View style={styles.bubbleTail} />
          </Animated.View>
        </View>

        {/* Hero: halo ring + the droplet that holds the day's water. */}
        <View style={styles.hero}>
          <HeroRipple rippleKey={rippleKey} reduceMotion={reduceMotion} />
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.ringCenter}>
              <ProgressRing size={RING_SIZE} progress={progress} reduceMotion={reduceMotion} complete={goalReached} />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Your water droplet, ${Math.round(progress * 100)} percent full. Tap to say hi.`}
            onPress={handlePoke}
          >
            <Mascot
              state={mascotState}
              size={MASCOT_SIZE}
              reduceMotion={reduceMotion}
              fill={progress}
              pokeKey={pokeKey}
            />
          </Pressable>
          <View style={styles.floatLayer} pointerEvents="none">
            {floats.map((f) => (
              <FloatLabel
                key={f.id}
                amount={f.amount}
                reduceMotion={reduceMotion}
                onDone={() => setFloats((current) => current.filter((x) => x.id !== f.id))}
              />
            ))}
          </View>
        </View>

        {/* Current amount / daily goal / percentage. */}
        <View style={styles.readout}>
          <View style={styles.amountRow}>
            <Hero style={styles.amount}>{displayedMl.toLocaleString()}</Hero>
            <Title tone="muted" style={styles.unit}>
              ml
            </Title>
          </View>
          <Body tone="secondary">
            of {formatVolume(goalMl)} · <Body tone="accent">{displayedPercent}%</Body>
          </Body>
          <Caption tone="faint" style={styles.lastSip}>
            {lastEntryAt ? `Last sip ${sinceLabel(now - lastEntryAt)}` : 'No sips yet today'}
          </Caption>
        </View>

        {!activeGoal ? (
          <Card glow>
            <BodyStrong>No active goal</BodyStrong>
            <Caption tone="secondary" style={styles.cardCopy}>
              Your last goal period has ended. Start a new one to keep the glass counting.
            </Caption>
            <View style={styles.cardAction}>
              <Button label="Start a new goal" onPress={() => router.push('/(onboarding)/goal')} />
            </View>
          </Card>
        ) : goalReached ? (
          <Animated.View entering={enterUp(0, reduceMotion)}>
            <LinearGradient
              colors={['rgba(178,249,102,0.18)', 'rgba(178,249,102,0.04)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.completeCard}
            >
              <View style={styles.completeIcon}>
                <Icon name="check" size={18} color={palette.ink950} strokeWidth={2.6} />
              </View>
              <View style={styles.flex}>
                <BodyStrong tone="success">Goal complete for today</BodyStrong>
                <Caption tone="secondary">
                  {settings.postGoalRemindersEnabled
                    ? 'Post-goal reminders are on, so the odd nudge may still come. Extra sips still count.'
                    : 'Reminders are off for the rest of the day. Extra sips still count in your log.'}
                </Caption>
              </View>
            </LinearGradient>
          </Animated.View>
        ) : (
          <View style={styles.statusRow}>
            <StatPill label="Still to go" value={formatVolume(left)} />
            <StatPill label="Drinks today" value={String(entries.length)} />
          </View>
        )}

        {/* Quick add (06.9) + custom amount (06.10). */}
        <SectionLabel style={styles.section}>Log a drink</SectionLabel>
        <View style={styles.quickRow}>
          {settings.quickAddMl.map((amount, index) => (
            <QuickAddButton
              key={amount}
              amount={amount}
              index={index}
              disabled={!activeGoal}
              onPress={() => void handleLog(amount)}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !activeGoal }}
          disabled={!activeGoal}
          style={({ pressed }) => [styles.customAction, pressed && styles.pressed, !activeGoal && styles.disabled]}
          onPress={() => router.push('/custom-amount')}
        >
          <View style={styles.customIcon}>
            <Icon name="plus" size={16} color={color.accent} strokeWidth={2.4} />
          </View>
          <BodyStrong tone="accent">Custom amount</BodyStrong>
        </Pressable>

        <View style={styles.reminderRow}>
          <Icon name={settings.notificationsEnabled ? 'bell' : 'bellOff'} size={15} color={color.textMuted} />
          <Caption tone="muted">{reminderLine}</Caption>
        </View>

        {/* Today's log. Any entry can be subtracted, not just the most recent. */}
        <SectionLabel style={styles.section}>Today</SectionLabel>
        {timeline.length > 0 ? (
          <View style={styles.timeline}>
            {timeline.map((entry) => (
              <Animated.View
                key={entry.id}
                entering={enterUp(0, reduceMotion)}
                exiting={reduceMotion ? undefined : FadeOutLeft.duration(duration.quick).easing(ease.out)}
                layout={reduceMotion ? undefined : LinearTransition.duration(duration.base).easing(ease.out)}
              >
                <EntryRow entry={entry} onSubtract={() => void handleSubtractEntry(entry)} />
              </Animated.View>
            ))}
          </View>
        ) : (
          <Card>
            <Body tone="secondary">Nothing logged yet today. Tap an amount above when you take a sip.</Body>
          </Card>
        )}
      </ScrollView>

      {/* The goal party: confetti from above, a burst from the droplet, a banner. */}
      <Confetti active={celebrating} reduceMotion={reduceMotion} />
      <Celebration active={celebrating} reduceMotion={reduceMotion} originY={insets.top + 250} />
      {celebrating ? (
        <Animated.View
          entering={enterPop(120, reduceMotion)}
          exiting={reduceMotion ? undefined : FadeOut.duration(duration.base)}
          style={[styles.banner, { top: insets.top + spacing.md }]}
          pointerEvents="none"
        >
          <Icon name="sparkle" size={18} color={palette.ink950} strokeWidth={2.4} />
          <Micro tone="onAccent" style={styles.bannerText}>
            GOAL COMPLETE · {formatVolume(goalMl)}
          </Micro>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Caption tone="muted">{label}</Caption>
      <BodyStrong style={styles.statValue}>{value}</BodyStrong>
    </View>
  );
}

/** An expanding ring from the droplet on every log — the "ripple" beat of 08. */
function HeroRipple({ rippleKey, reduceMotion }: { rippleKey: number; reduceMotion: boolean }) {
  const t = useSharedValue(1);
  useEffect(() => {
    if (rippleKey === 0 || reduceMotion) return;
    t.value = 0;
    t.value = withTiming(1, { duration: 700, easing: ease.out });
  }, [rippleKey, reduceMotion, t]);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * 0.7,
    transform: [{ scale: 0.6 + t.value * 0.7 }],
  }));
  return <Animated.View style={[styles.ripple, style]} pointerEvents="none" />;
}

/** "+250 ml" rising off the droplet and fading out. */
function FloatLabel({
  amount,
  reduceMotion,
  onDone,
}: {
  amount: number;
  reduceMotion: boolean;
  onDone: () => void;
}) {
  const t = useSharedValue(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    t.value = withTiming(1, { duration: reduceMotion ? 500 : 900, easing: ease.out });
    const timer = setTimeout(() => doneRef.current(), reduceMotion ? 550 : 950);
    return () => clearTimeout(timer);
  }, [reduceMotion, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.2 ? t.value / 0.2 : 1 - (t.value - 0.2) / 0.8,
    transform: [
      { translateY: reduceMotion ? 0 : -t.value * 90 },
      { scale: reduceMotion ? 1 : 0.8 + Math.min(t.value * 2, 1) * 0.3 },
    ],
  }));

  return (
    <Animated.View style={[styles.float, style]}>
      <BodyStrong style={styles.floatText}>+{amount} ml</BodyStrong>
    </Animated.View>
  );
}

/**
 * One logged drink. The minus button subtracts that amount from the day —
 * 09, "edits/deletes should be explicit".
 */
function EntryRow({ entry, onSubtract }: { entry: WaterEntry; onSubtract: () => void }) {
  const sourceLabel =
    entry.source === 'notification' ? 'from a nudge' : entry.source === 'custom' ? 'custom' : 'quick add';
  return (
    <View style={styles.entryRow}>
      <LinearGradient
        colors={gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.entryDrop}
      >
        <Icon name="drop" size={15} color={palette.ink950} strokeWidth={2.3} />
      </LinearGradient>
      <View style={styles.flex}>
        <BodyStrong>{formatMl(entry.amountMl)}</BodyStrong>
        <Caption tone="muted">
          {formatTime(entry.loggedAt)} · {sourceLabel}
        </Caption>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Subtract ${entry.amountMl} millilitres logged at ${formatTime(entry.loggedAt)}`}
        hitSlop={10}
        onPress={onSubtract}
        style={({ pressed }) => [styles.minusButton, pressed && styles.minusButtonPressed]}
      >
        <Icon name="minus" size={16} color={color.textSecondary} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

/** Matiks-style tiles: pastel faces on a darker edge. */
const QUICK_TILES = [
  { face: palette.lavender400, edge: palette.lavender600 },
  { face: palette.teal400, edge: palette.teal600 },
  { face: palette.yellow400, edge: palette.yellow600 },
] as const;

function QuickAddButton({
  amount,
  index,
  disabled,
  onPress,
}: {
  amount: number;
  index: number;
  /** No goal running: there is no target for the drink to count toward. */
  disabled?: boolean;
  onPress: () => void;
}) {
  const tile = QUICK_TILES[index % QUICK_TILES.length];
  return (
    <PressTile
      face={tile.face}
      edge={tile.edge}
      onPress={onPress}
      disabled={disabled}
      hapticOnPress={false}
      accessibilityLabel={`Log ${amount} millilitres`}
      style={styles.quickWrap}
      faceStyle={styles.quickButton}
    >
      <Icon name="drop" size={18} color={palette.ink950} strokeWidth={2.4} />
      <Title tone="onAccent" style={styles.quickLabel}>
        {amount}
      </Title>
      <Micro tone="onAccent" style={styles.quickUnit}>
        ML
      </Micro>
    </PressTile>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipWarm: {
    borderColor: 'rgba(235,179,107,0.45)',
    backgroundColor: 'rgba(235,179,107,0.12)',
  },
  hero: {
    height: RING_SIZE + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  ringCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: palette.teal300,
  },
  floatLayer: {
    position: 'absolute',
    top: RING_SIZE * 0.22,
    alignItems: 'center',
    left: 0,
    right: 0,
  },
  float: {
    position: 'absolute',
    backgroundColor: 'rgba(14,14,14,0.92)',
    borderWidth: 1,
    borderColor: color.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  floatText: {
    color: palette.teal300,
    fontFamily: font.display,
  },
  readout: {
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  lastSip: {
    marginTop: 2,
  },
  bubbleRow: {
    alignItems: 'center',
    marginTop: spacing.lg,
    minHeight: 46,
  },
  bubble: {
    maxWidth: '82%',
    backgroundColor: color.surfaceStrong,
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  bubbleText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: color.surfaceStrong,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.borderStrong,
    transform: [{ rotate: '45deg' }],
  },
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.lime400,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 3,
    borderBottomColor: palette.lime700,
  },
  bannerText: {
    fontSize: 13,
    letterSpacing: 1.4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  amount: {
    color: color.textPrimary,
  },
  unit: {
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statPill: {
    flex: 1,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  statValue: {
    fontFamily: font.display,
    fontSize: 20,
    lineHeight: 26,
  },
  completeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(178,249,102,0.35)',
    padding: spacing.lg,
  },
  completeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.lime400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    marginTop: spacing.xs,
  },
  cardAction: {
    marginTop: spacing.lg,
  },
  section: {
    marginTop: spacing.xl,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickWrap: {
    flex: 1,
  },
  quickButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  quickLabel: {
    marginTop: 2,
  },
  quickUnit: {
    opacity: 0.7,
  },
  customAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  customIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accentWash,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  timeline: {
    gap: spacing.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  entryDrop: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceSunk,
  },
  minusButtonPressed: {
    backgroundColor: color.accentWash,
    borderColor: color.accent,
  },
});
