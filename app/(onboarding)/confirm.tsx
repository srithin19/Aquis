/**
 * Goal confirmation — Product Bible 06.8.
 *
 * "Show daily target, duration and Day 1." The mascot fills to the selected
 * daily target and celebrates. CTA: Start my goal.
 *
 * This is where the draft becomes a domain record: the goal period, the
 * notification preference and the onboarding flag are all written here, so a
 * half-finished onboarding leaves nothing behind.
 */

import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Celebration } from '@/components/Celebration';
import { MascotStage } from '@/components/Mascot';
import { Body, Button, Caption, Card, Notice, Screen, Spacer, Title } from '@/components/ui';
import { addDays, formatDayLabel, todayLocal } from '@/domain/date';
import { formatVolume } from '@/domain/hydration';
import { useAppState } from '@/state/AppProvider';
import { useOnboarding } from '@/state/OnboardingProvider';
import { color, spacing } from '@/theme';
import { play } from '@/services/sound';
import { haptic } from '@/utils/haptics';

export default function GoalConfirmScreen() {
  const { startGoal, updateSettings, reduceMotion, activeGoal, goalDay } = useAppState();
  const { dailyGoalMl, durationDays, notificationsEnabled, reset } = useOnboarding();
  const [fill, setFill] = useState(0);
  const [burst, setBurst] = useState(false);
  const [busy, setBusy] = useState(false);
  // A ref, not state: a double tap must not start two goals.
  const startingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const start = todayLocal();
  const end = addDays(start, durationDays - 1);

  // The droplet fills to the selected target as the screen settles.
  useEffect(() => {
    if (reduceMotion) {
      setFill(1);
      return;
    }
    const timer = setTimeout(() => setFill(1), 260);
    const burstTimer = setTimeout(() => {
      setBurst(true);
      haptic('light');
      play('twinkle');
    }, 1100);
    return () => {
      clearTimeout(timer);
      clearTimeout(burstTimer);
    };
  }, [reduceMotion]);

  const handleStart = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      // Settings first: startGoal rebuilds the reminder plan from stored
      // settings, so the preference must already be saved when it runs.
      await updateSettings({ notificationsEnabled, onboardingCompleted: true });
      await startGoal({ dailyGoalMl, durationDays });
      haptic('success');
      reset();
      // Back to the tabs already underneath (a new goal from inside the app),
      // or onto them for the first time — never a second copy of them.
      router.dismissTo('/(tabs)');
    } catch (cause) {
      startingRef.current = false;
      setBusy(false);
      setError(cause instanceof Error ? cause.message : 'Could not save your goal. Try again?');
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.hero}>
        <MascotStage
          state={fill >= 1 ? 'celebrating' : 'happy'}
          size={196}
          reduceMotion={reduceMotion}
          fill={fill}
        />
      </View>

      <Spacer size={spacing.xl} />

      <Title center>You are all set.</Title>
      <Spacer size={spacing.sm} />
      <Body tone="secondary" center>
        Here is the goal AQUIS will keep you company on.
      </Body>

      <Spacer size={spacing.xl} />

      <Card glow>
        <Row label="Daily target" value={formatVolume(dailyGoalMl)} />
        <Divider />
        <Row label="Goal length" value={`${durationDays} days`} />
        <Divider />
        <Row label="Starting" value={`Day 1 — ${formatDayLabel(start)}`} />
        <Divider />
        <Row label="Ending" value={formatDayLabel(end)} />
        <Divider />
        <Row label="Reminders" value={notificationsEnabled ? 'On' : 'Off'} />
      </Card>
      <Celebration active={burst} reduceMotion={reduceMotion} />

      {error ? (
        <>
          <Spacer size={spacing.md} />
          <Notice text={error} tone="accent" />
        </>
      ) : null}

      {activeGoal ? (
        <>
          <Spacer size={spacing.md} />
          <Notice
            tone="secondary"
            text={`This replaces your current goal (day ${goalDay} of ${activeGoal.durationDays}). Today’s drinks count toward the new target; earlier days keep theirs.`}
          />
        </>
      ) : null}

      <Spacer size={spacing.xl} />
      <Button label={busy ? 'Starting…' : 'Start my goal'} disabled={busy} onPress={() => void handleStart()} />
      <Spacer size={spacing.md} />
      <Caption tone="muted" center>
        Changing your goal later starts a new period. Earlier days keep the target they had.
      </Caption>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Body tone="secondary">{label}</Body>
      <Body style={styles.rowValue}>{value}</Body>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  rowValue: {
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.borderStrong,
    marginVertical: spacing.md,
  },
});
