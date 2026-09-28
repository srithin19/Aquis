/**
 * Streak logic — Product Bible 11 / 12.
 *
 * One explicit rule: a day is successful when it reached 100% of that day's own
 * target (`DailyHydration.completed`, frozen per day). Streaks are computed
 * from daily completion records, never from notification interactions.
 *
 * Today not being complete *yet* does not break the streak — the day is still
 * running. The current streak counts back from today when today is done, and
 * from yesterday otherwise.
 */

import { addDays } from './date';
import type { LocalDate, StreakState } from './types';

export interface DayOutcome {
  date: LocalDate;
  completed: boolean;
}

export function computeStreak(days: readonly DayOutcome[], today: LocalDate): StreakState {
  const successful = new Set(days.filter((d) => d.completed).map((d) => d.date));

  // Current streak.
  let cursor = successful.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (successful.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  // Longest streak over every recorded run of consecutive calendar days.
  const sorted = [...successful].sort();
  let longest = 0;
  let run = 0;
  let previous: LocalDate | null = null;
  for (const date of sorted) {
    run = previous !== null && addDays(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  return {
    current,
    longest: Math.max(longest, current),
    lastSuccessfulDate: sorted.length > 0 ? sorted[sorted.length - 1] : null,
  };
}

/** Streak lengths worth a milestone celebration (12). */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export function isStreakMilestone(length: number): boolean {
  return (STREAK_MILESTONES as readonly number[]).includes(length);
}
