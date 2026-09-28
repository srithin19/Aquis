/**
 * History — Product Bible 06.12 (calendar) with weekly/monthly summary (05).
 *
 * Every droplet reads the day's own frozen record — its own goal, its own
 * consumed total — so a later goal change never repaints the past (11). Tap a
 * day for its detail and timeline (06.13).
 */

import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useTabBarInset } from '@/components/layout';
import { MiniDroplet } from '@/components/MiniDroplet';
import { BodyStrong, Caption, Card, enterFade, Micro, SectionLabel, Title } from '@/components/ui';
import {
  addDays,
  addMonths,
  buildMonthGrid,
  compareDates,
  formatMonthLabel,
  fromLocalDate,
  monthOf,
  WEEKDAY_INITIALS,
} from '@/domain/date';
import { formatVolume } from '@/domain/hydration';
import type { DailyHydration, LocalDate } from '@/domain/types';
import { listDailyRecords } from '@/repositories/hydrationRepository';
import { useAppState } from '@/state/AppProvider';
import { color, font, palette, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

/** How far back the month selector goes. */
const MAX_MONTHS_BACK = 24;

export default function HistoryScreen() {
  const { today, revision, streak, reduceMotion } = useAppState();
  const bottomInset = useTabBarInset();
  const currentMonth = monthOf(today);
  const [month, setMonth] = useState(currentMonth);
  // A new month began while the app was open: follow it.
  useEffect(() => setMonth(currentMonth), [currentMonth]);
  const [records, setRecords] = useState<Map<LocalDate, DailyHydration>>(new Map());
  const [week, setWeek] = useState<DailyHydration[]>([]);

  const grid = useMemo(() => buildMonthGrid(month), [month]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const first = `${month}-01`;
      const last = addDays(addMonths(month, 1) + '-01', -1);
      void Promise.all([
        listDailyRecords(first, last),
        listDailyRecords(addDays(today, -6), today),
      ])
        .then(([monthRows, weekRows]) => {
          if (!active) return;
          setRecords(new Map(monthRows.map((row) => [row.date, row])));
          setWeek(weekRows);
        })
        .catch(() => {
          /* Keep what is on screen; the next focus retries. */
        });
      return () => {
        active = false;
      };
      // `revision` refetches after any log, even while this tab stays mounted.
    }, [month, today, revision]),
  );

  const monthStats = useMemo(() => {
    const tracked = [...records.values()].filter((r) => r.goalMl > 0 && compareDates(r.date, today) <= 0);
    const hit = tracked.filter((r) => r.completed).length;
    const avg = tracked.length
      ? Math.round(tracked.reduce((s, r) => s + r.completionPercent, 0) / tracked.length)
      : 0;
    return { tracked: tracked.length, hit, avg };
  }, [records, today]);

  const weekStats = useMemo(() => {
    const total = week.reduce((s, r) => s + r.consumedMl, 0);
    const hit = week.filter((r) => r.completed).length;
    const avg = Math.round(week.reduce((s, r) => s + r.completionPercent, 0) / 7);
    return { total, hit, avg };
  }, [week]);

  const canGoBack = month > addMonths(currentMonth, -MAX_MONTHS_BACK);
  const canGoForward = month < currentMonth;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <Title>History</Title>
        <Caption tone="muted">Every droplet is one day, filled to how far you got.</Caption>

        {/* This week (05 — weekly summary). */}
        <View style={styles.statsRow}>
          <Stat label="7-day avg" value={`${weekStats.avg}%`} tint={palette.teal300} />
          <Stat label="Goals hit" value={`${weekStats.hit}/7`} tint={palette.lime400} />
          <Stat label="Streak" value={String(streak.current)} tint={palette.orange400} />
        </View>

        <Card style={styles.calendar}>
          <View style={styles.monthRow}>
            <MonthButton
              icon="chevronLeft"
              disabled={!canGoBack}
              label="Previous month"
              onPress={() => setMonth((m) => addMonths(m, -1))}
            />
            <View style={styles.monthTitle}>
              <BodyStrong style={styles.monthLabel}>{formatMonthLabel(month)}</BodyStrong>
              <Caption tone="muted">
                {monthStats.tracked > 0
                  ? `${monthStats.hit} of ${monthStats.tracked} days at 100% · avg ${monthStats.avg}%`
                  : 'No days logged yet'}
              </Caption>
            </View>
            <MonthButton
              icon="chevronRight"
              disabled={!canGoForward}
              label="Next month"
              onPress={() => setMonth((m) => addMonths(m, 1))}
            />
          </View>

          <View style={styles.weekHeader}>
            {WEEKDAY_INITIALS.map((d, i) => (
              <Micro key={i} tone="faint" style={styles.weekday}>
                {d}
              </Micro>
            ))}
          </View>

          <Animated.View key={month} entering={enterFade(0, reduceMotion)}>
            {grid.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.week}>
                {row.map((date, colIndex) => {
                  if (!date) return <View key={colIndex} style={styles.cell} />;
                  const record = records.get(date);
                  const isToday = date === today;
                  const isFuture = compareDates(date, today) > 0;
                  const dayNumber = Number(date.slice(8));
                  return (
                    <Pressable
                      key={date}
                      accessibilityRole="button"
                      accessibilityLabel={`${date}, ${record ? `${record.completionPercent}%` : 'nothing logged'}`}
                      disabled={isFuture}
                      onPress={() => {
                        haptic('light');
                        router.push({ pathname: '/day/[date]', params: { date } });
                      }}
                      style={({ pressed }) => [
                        styles.cell,
                        isToday && styles.todayCell,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MiniDroplet
                        percent={record?.completionPercent ?? 0}
                        size={26}
                        dim={isFuture || !record || record.goalMl <= 0}
                        delay={(rowIndex * 7 + colIndex) * 18}
                        reduceMotion={reduceMotion}
                      />
                      <Micro
                        tone={isToday ? 'accent' : isFuture ? 'faint' : record?.completed ? 'success' : 'muted'}
                        style={styles.dayNumber}
                      >
                        {dayNumber}
                      </Micro>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Animated.View>
        </Card>

        <SectionLabel style={styles.section}>Last 7 days</SectionLabel>
        <Card>
          <View style={styles.bars}>
            {Array.from({ length: 7 }, (_, i) => {
              const date = addDays(today, i - 6);
              const record = week.find((r) => r.date === date);
              const pct = record?.completionPercent ?? 0;
              return (
                <Pressable
                  key={date}
                  style={styles.barCol}
                  onPress={() => router.push({ pathname: '/day/[date]', params: { date } })}
                >
                  <View style={styles.barTrack}>
                    <Animated.View
                      entering={enterFade(i * 40, reduceMotion)}
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(pct, 3)}%`,
                          backgroundColor: record?.completed ? palette.lime400 : palette.teal400,
                          opacity: pct > 0 ? 1 : 0.25,
                        },
                      ]}
                    />
                  </View>
                  <Micro tone={date === today ? 'accent' : 'muted'}>
                    {WEEKDAY_INITIALS[(fromLocalDate(date).getDay() + 6) % 7]}
                  </Micro>
                </Pressable>
              );
            })}
          </View>
          <Caption tone="muted" center style={styles.barCaption}>
            {formatVolume(weekStats.total)} this week
          </Caption>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View style={styles.stat}>
      <BodyStrong style={[styles.statValue, { color: tint }]}>{value}</BodyStrong>
      <Caption tone="muted">{label}</Caption>
    </View>
  );
}

function MonthButton({
  icon,
  disabled,
  label,
  onPress,
}: {
  icon: 'chevronLeft' | 'chevronRight';
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => [styles.monthButton, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Icon name={icon} size={18} color={color.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  stat: {
    flex: 1,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  statValue: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 28,
  },
  calendar: {
    paddingHorizontal: spacing.sm,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  monthTitle: {
    flex: 1,
    alignItems: 'center',
  },
  monthLabel: {
    fontFamily: font.displayMedium,
    fontSize: 18,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceStrong,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  week: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  todayCell: {
    backgroundColor: color.accentWash,
    borderWidth: 1,
    borderColor: color.accentSoft,
  },
  dayNumber: {
    marginTop: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.3,
  },
  section: {
    marginTop: spacing.xl,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: spacing.sm,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    height: '100%',
  },
  barTrack: {
    flex: 1,
    width: '70%',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: radius.sm,
  },
  barCaption: {
    marginTop: spacing.md,
  },
});
