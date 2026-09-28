/**
 * End-of-goal summary — Product Bible 04 ("Goal completion") and 11.
 *
 * "When the final day ends, AQUIS freezes that goal period, stores the
 * historical goal and result, shows the end-of-goal summary and uses a
 * sad-but-gentle mascot state if the target was not completed." The copy is
 * honest about the result and never scolds (01, "Progress without guilt").
 */

import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Celebration } from '@/components/Celebration';
import { MascotStage } from '@/components/Mascot';
import { MiniDroplet } from '@/components/MiniDroplet';
import { Body, BodyStrong, Button, Caption, Card, Display, enterPop, enterUp, Micro, Screen } from '@/components/ui';
import { addDays } from '@/domain/date';
import { formatVolume } from '@/domain/hydration';
import type { DailyHydration } from '@/domain/types';
import { listDailyRecords } from '@/repositories/hydrationRepository';
import { play } from '@/services/sound';
import { useAppState } from '@/state/AppProvider';
import { font, palette, spacing } from '@/theme';

export default function GoalSummaryScreen() {
  const { goalSummary, acknowledgeGoalSummary, reduceMotion } = useAppState();
  const [days, setDays] = useState<DailyHydration[]>([]);
  const [busy, setBusy] = useState(false);

  const goalId = goalSummary?.goal.id;
  const crushedPeriod = goalSummary?.crushed ?? false;
  useEffect(() => {
    if (crushedPeriod) play('celebrate');
  }, [goalId, crushedPeriod]);
  useEffect(() => {
    if (!goalSummary) return;
    void listDailyRecords(goalSummary.goal.startDate, goalSummary.goal.endDate)
      .then(setDays)
      .catch(() => setDays([]));
    // Keyed on the goal, not the object (a refresh rebuilds the object).
  }, [goalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = async (next: 'new' | 'home') => {
    if (busy) return;
    setBusy(true);
    try {
      await acknowledgeGoalSummary();
    } catch {
      // Still let the user move on; the summary simply shows again next time.
    }
    if (next === 'new') router.replace('/(onboarding)/goal');
    else router.dismissTo('/(tabs)');
  };

  // Android back = "Not right now", so the summary is acknowledged, not lost.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void finish('home');
      return true;
    });
    return () => sub.remove();
  });

  // Nothing to summarise (already acknowledged elsewhere): go home.
  useEffect(() => {
    if (!goalSummary && !busy) router.dismissTo('/(tabs)');
  }, [goalSummary, busy]);

  if (!goalSummary) return null;

  const { goal, daysCompleted, averagePercent, totalMl, crushed } = goalSummary;
  const byDate = new Map(days.map((d) => [d.date, d]));

  return (
    <Screen scroll contentStyle={styles.content}>
      <Celebration active={crushed} reduceMotion={reduceMotion} />
      <Animated.View entering={enterPop(0, reduceMotion)} style={styles.hero}>
        <MascotStage state={crushed ? 'celebrating' : 'sad'} size={150} reduceMotion={reduceMotion} />
      </Animated.View>

      <Micro tone={crushed ? 'success' : 'accent'} center>
        GOAL PERIOD COMPLETE
      </Micro>
      <Display center style={styles.title}>
        {crushed ? 'You crushed it.' : daysCompleted > 0 ? 'That was a real effort.' : 'A fresh start awaits.'}
      </Display>
      <Body tone="secondary" center>
        {crushed
          ? `Every one of your ${goal.durationDays} days reached ${formatVolume(goal.dailyGoalMl)}.`
          : `You reached ${formatVolume(goal.dailyGoalMl)} on ${daysCompleted} of ${goal.durationDays} days. Every sip still counted.`}
      </Body>

      <Animated.View entering={enterUp(160, reduceMotion)}>
        <View style={styles.stats}>
          <Stat value={`${daysCompleted}/${goal.durationDays}`} label="days at 100%" tint={palette.lime400} />
          <Stat value={`${averagePercent}%`} label="average" tint={palette.teal300} />
          <Stat value={formatVolume(totalMl)} label="total" tint={palette.lavender400} />
        </View>

        <Card>
          <Caption tone="muted">Day by day</Caption>
          <View style={styles.days}>
            {Array.from({ length: Math.min(goal.durationDays, 42) }, (_, i) => {
              const date = addDays(goal.startDate, i);
              return (
                <MiniDroplet
                  key={date}
                  percent={byDate.get(date)?.completionPercent ?? 0}
                  size={24}
                  delay={300 + i * 40}
                  reduceMotion={reduceMotion}
                />
              );
            })}
          </View>
        </Card>
      </Animated.View>

      <View style={styles.actions}>
        <Button label="Start a new goal" disabled={busy} onPress={() => void finish('new')} />
        <Button label="Not right now" variant="ghost" disabled={busy} onPress={() => void finish('home')} />
      </View>
    </Screen>
  );
}

function Stat({ value, label, tint }: { value: string; label: string; tint: string }) {
  return (
    <View style={styles.stat}>
      <BodyStrong style={[styles.statValue, { color: tint }]}>{value}</BodyStrong>
      <Caption tone="muted">{label}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.xl,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 28,
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
});
