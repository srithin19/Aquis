/**
 * Day detail — Product Bible 06.13.
 *
 * Date, the goal active on that date, consumed amount, completion, and the
 * timeline of entries. "Timeline entries appear sequentially; glass fills to
 * the day's final level." Everything is read from that day's frozen record, so
 * it shows the target that applied then, not today's (11).
 */

import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Mascot } from '@/components/Mascot';
import { Body, BodyStrong, Caption, Card, Divider, enterUp, Hero, Micro, SectionLabel, Title } from '@/components/ui';
import { formatDayLabel, formatTime } from '@/domain/date';
import { formatMl, formatVolume } from '@/domain/hydration';
import type { DailyHydration, Goal, WaterEntry } from '@/domain/types';
import { getGoalById, getGoalForDate } from '@/repositories/goalRepository';
import { getDailyRecord, listEntriesForDate } from '@/repositories/hydrationRepository';
import { useAppState } from '@/state/AppProvider';
import { color, palette, radius, spacing } from '@/theme';

export default function DayDetailScreen() {
  const params = useLocalSearchParams<{ date: string }>();
  // Only a real YYYY-MM-DD opens a day; anything else shows "not found".
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date : undefined;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/history'));
  const { reduceMotion, revision } = useAppState();
  const [record, setRecord] = useState<DailyHydration | null>(null);
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!date) return;
    let active = true;
    void (async () => {
      try {
        const [day, dayEntries] = await Promise.all([getDailyRecord(date), listEntriesForDate(date)]);
        const dayGoal = day?.goalId ? await getGoalById(day.goalId) : await getGoalForDate(date);
        if (!active) return;
        setRecord(day);
        setEntries(dayEntries);
        setGoal(dayGoal);
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [date, revision]);

  const percent = record?.completionPercent ?? 0;
  const goalMl = record?.goalMl ?? 0;
  const mascotState = record?.completed ? 'proud' : percent >= 50 ? 'happy' : percent > 0 ? 'idle' : 'sleepy';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Micro tone="muted">DAY DETAIL</Micro>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          onPress={close}
          style={styles.close}
        >
          <Icon name="close" size={18} color={color.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Title>{date ? formatDayLabel(date) : 'Day not found'}</Title>

        <View style={styles.hero}>
          <Mascot
            state={loaded ? mascotState : 'idle'}
            size={150}
            reduceMotion={reduceMotion}
            fill={loaded ? percent / 100 : 0}
          />
          <View style={styles.heroText}>
            <Hero style={styles.percent}>{percent}%</Hero>
            <Body tone="secondary">
              {formatVolume(record?.consumedMl ?? 0)} of {goalMl > 0 ? formatVolume(goalMl) : '—'}
            </Body>
            {record?.completed ? (
              <View style={styles.badge}>
                <Icon name="check" size={13} color={palette.ink950} strokeWidth={2.6} />
                <Micro tone="onAccent">GOAL HIT</Micro>
              </View>
            ) : null}
          </View>
        </View>

        <Card>
          <Row label="Goal that day" value={goalMl > 0 ? `${formatVolume(goalMl)} a day` : 'No goal set'} />
          {goal ? (
            <>
              <Divider />
              <Row
                label="Goal period"
                value={`${formatDayLabel(goal.startDate).split(',')[0]} · ${goal.durationDays} days`}
              />
            </>
          ) : null}
          <Divider />
          <Row label="Drinks logged" value={String(record?.entryCount ?? 0)} />
          {record?.firstEntryAt && record.lastEntryAt ? (
            <>
              <Divider />
              <Row
                label="First → last sip"
                value={`${formatTime(record.firstEntryAt)} → ${formatTime(record.lastEntryAt)}`}
              />
            </>
          ) : null}
        </Card>

        <SectionLabel style={styles.section}>Timeline</SectionLabel>
        {loaded && entries.length === 0 ? (
          <Card>
            <Body tone="secondary">No drinks were logged on this day.</Body>
          </Card>
        ) : (
          <View style={styles.timeline}>
            {entries.map((entry, index) => {
              const runningTotal = entries.slice(0, index + 1).reduce((s, e) => s + e.amountMl, 0);
              return (
                <Animated.View
                  key={entry.id}
                  entering={enterUp(80 + index * 50, reduceMotion)}
                  style={styles.entry}
                >
                  <View style={styles.rail}>
                    <View style={styles.dot} />
                    {index < entries.length - 1 ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.entryBody}>
                    <BodyStrong>{formatMl(entry.amountMl)}</BodyStrong>
                    <Caption tone="muted">
                      {formatTime(entry.loggedAt)} · total {formatVolume(runningTotal)}
                    </Caption>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Caption tone="muted">{label}</Caption>
      <BodyStrong style={styles.rowValue}>{value}</BodyStrong>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.surfaceSolid,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceStrong,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginVertical: spacing.xl,
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  percent: {
    color: palette.teal300,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: palette.lime400,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  section: {
    marginTop: spacing.xl,
  },
  timeline: {
    paddingLeft: spacing.xs,
  },
  entry: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    width: 14,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
    backgroundColor: palette.teal400,
    shadowColor: palette.teal400,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: 2,
    backgroundColor: 'rgba(92,225,230,0.3)',
  },
  entryBody: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
});
