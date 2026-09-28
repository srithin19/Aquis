/**
 * Notification planning — Product Bible 10.
 *
 *   Last drink → minimum gap check → goal status → daily notification limit →
 *   user quiet state → randomized eligible time → local notification.
 *
 * This module is pure: it turns the current state into a short list of future
 * reminder times, and the notification service schedules exactly those. The
 * plan is thrown away and rebuilt on every water log, app foreground and
 * settings change, which is what makes the two hardest rules hold:
 *
 *  - "When the user returns to an eligible state, recalculate instead of firing
 *    all missed notifications." Only future times are ever planned.
 *  - "If multiple suppression rules overlap, suppress rather than queue a
 *    burst." A suppressed slot moves to the next eligible window; it is never
 *    doubled up.
 *
 * Active-call and prolonged-screen-use signals are not exposed to Expo apps, so
 * per the "Important platform limitation" note these fall back to time-based
 * rules. The one live signal we do have — the user has AQUIS open right now —
 * is applied in the service's foreground handler.
 */

import { toLocalDate } from './date';
import { formatVolume, remainingMl } from './hydration';
import type { LocalDate } from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The opportunity window after a drink (or after the previous reminder). */
export const WINDOW_MIN_MS = 2.5 * HOUR;
export const WINDOW_MAX_MS = 3.25 * HOUR;
/** First opportunity of a day, counted from waking / the end of quiet hours. */
export const FIRST_MIN_MS = 45 * MINUTE;
export const FIRST_MAX_MS = 1.5 * HOUR;
/** "Do not notify immediately after a water entry." */
export const MIN_GAP_AFTER_DRINK_MS = 90 * MINUTE;
/** Never schedule something that fires the moment the plan is rebuilt. */
export const MIN_LEAD_MS = 20 * MINUTE;
/** "Apply a daily notification cap to prevent irritation." */
export const DEFAULT_DAILY_CAP = 6;
/** How far ahead we plan. Rebuilt far more often than this in practice. */
export const HORIZON_MS = 30 * HOUR;
export const MAX_PENDING = 8;

export interface ReminderPlanInput {
  now: number;
  enabled: boolean;
  /** Most recent entry today, epoch ms. */
  lastDrinkAt: number | null;
  goalReachedToday: boolean;
  postGoalReminders: boolean;
  quietStart: string; // 'HH:mm'
  quietEnd: string; // 'HH:mm'
  /** Reminders already delivered today (count against the cap). */
  deliveredToday: number;
  /** The goal period's last day: nothing is planned after it. */
  lastDay?: LocalDate | null;
  dailyCap?: number;
  random?: () => number;
}

export interface PlannedReminder {
  at: number;
  date: LocalDate;
  reason: 'after_drink' | 'first_of_day' | 'follow_up';
}

export function parseClock(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return ((Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)) % (24 * 60);
}

export function formatClock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function minuteOfDay(t: number): number {
  const d = new Date(t);
  return d.getHours() * 60 + d.getMinutes();
}

/** Quiet hours may wrap past midnight (22:00 → 07:00). Equal bounds = no quiet hours. */
export function isQuietTime(t: number, quietStart: string, quietEnd: string): boolean {
  const start = parseClock(quietStart);
  const end = parseClock(quietEnd);
  if (start === end) return false;
  const m = minuteOfDay(t);
  return start < end ? m >= start && m < end : m >= start || m < end;
}

/** The next moment at or after `t` when quiet hours end. */
export function nextQuietEnd(t: number, quietEnd: string): number {
  const end = parseClock(quietEnd);
  const d = new Date(t);
  d.setHours(Math.floor(end / 60), end % 60, 0, 0);
  if (d.getTime() <= t) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** The local midnight that starts the day after `t`. */
function nextMidnight(t: number): number {
  const d = new Date(t);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

export function planReminders(input: ReminderPlanInput): PlannedReminder[] {
  if (!input.enabled) return [];

  const random = input.random ?? Math.random;
  const cap = input.dailyCap ?? DEFAULT_DAILY_CAP;
  const { now, quietStart, quietEnd } = input;
  const today = toLocalDate(new Date(now));
  const horizon = now + HORIZON_MS;

  const perDay = new Map<LocalDate, number>([[today, input.deliveredToday]]);
  const blockedDays = new Set<LocalDate>();
  if (input.goalReachedToday && !input.postGoalReminders) blockedDays.add(today);

  const plan: PlannedReminder[] = [];
  const pick = (from: number, to: number) => from + random() * Math.max(to - from, 0);

  // Where the next window is measured from.
  let anchor: number;
  let reason: PlannedReminder['reason'];
  if (input.lastDrinkAt !== null && toLocalDate(new Date(input.lastDrinkAt)) === today) {
    anchor = input.lastDrinkAt;
    reason = 'after_drink';
  } else {
    anchor = now;
    reason = 'first_of_day';
  }

  for (let guard = 0; guard < 40 && plan.length < MAX_PENDING; guard += 1) {
    let from: number;
    let to: number;
    if (reason === 'first_of_day') {
      from = anchor + FIRST_MIN_MS;
      to = anchor + FIRST_MAX_MS;
    } else {
      from = anchor + WINDOW_MIN_MS;
      to = anchor + WINDOW_MAX_MS;
    }
    if (reason === 'after_drink') from = Math.max(from, anchor + MIN_GAP_AFTER_DRINK_MS);

    // Minimum lead: never fire the instant we recalculate (no backlog burst).
    const earliest = now + MIN_LEAD_MS;
    if (to < earliest) {
      from = earliest;
      to = earliest + 45 * MINUTE;
    } else {
      from = Math.max(from, earliest);
    }

    let at = Math.round(pick(from, to));

    // Quiet hours: move to the first window after waking, never queue.
    if (isQuietTime(at, quietStart, quietEnd)) {
      anchor = nextQuietEnd(at, quietEnd);
      reason = 'first_of_day';
      continue;
    }

    const date = toLocalDate(new Date(at));

    // Goal complete today, or today's cap reached: nothing more today.
    if (blockedDays.has(date) || (perDay.get(date) ?? 0) >= cap) {
      const midnight = nextMidnight(at);
      anchor = isQuietTime(midnight, quietStart, quietEnd) ? nextQuietEnd(midnight, quietEnd) : midnight;
      reason = 'first_of_day';
      continue;
    }

    if (at > horizon) break;
    if (input.lastDay && date > input.lastDay) break;

    plan.push({ at, date, reason });
    perDay.set(date, (perDay.get(date) ?? 0) + 1);
    anchor = at;
    reason = 'follow_up';
  }

  return plan;
}

/** "Copy should rotate, remain concise and never become guilt-driven." */
export const REMINDER_TITLES: readonly string[] = [
  'Tiny hydration break? 💧',
  'A good moment for a sip 💧',
  'Your glass is waiting 💧',
  'Nice focus session — sip? 💧',
  'Quick refill? 💧',
  'Sip o’clock 💧',
];

export function titleFor(at: number, index: number): string {
  const seed = Math.floor(at / HOUR) + index;
  return REMINDER_TITLES[seed % REMINDER_TITLES.length];
}

/**
 * The one-line body: where the day stands. Accurate at delivery because the
 * plan is rebuilt after every log — a reminder for today always carries
 * today's latest total, and one for a later day starts from an empty glass.
 */
export function reminderBody(input: {
  forToday: boolean;
  consumedMl: number;
  goalMl: number;
}): string {
  const { forToday, consumedMl, goalMl } = input;
  if (goalMl <= 0) return 'Tap to log a drink in one go.';
  if (!forToday) return `New day, fresh glass · 0 of ${formatVolume(goalMl)}`;
  const pct = Math.round(Math.min(consumedMl / goalMl, 1) * 100);
  const left = remainingMl(consumedMl, goalMl);
  if (left <= 0) return `${formatVolume(consumedMl)} today · goal done, this one’s a bonus`;
  return `${formatVolume(consumedMl)} of ${formatVolume(goalMl)} (${pct}%) · ${formatVolume(left)} to go`;
}
