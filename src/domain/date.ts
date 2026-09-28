/**
 * Local-date helpers.
 *
 * A "day" in AQUIS is the user's local calendar day. We deliberately never use
 * `toISOString()` for day keys — that shifts to UTC and would move a late-night
 * glass of water into tomorrow.
 */

import type { LocalDate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalDate(d: Date = new Date()): LocalDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromLocalDate(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayLocal(): LocalDate {
  return toLocalDate();
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = fromLocalDate(date);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

/** Whole calendar days from `a` to `b`; negative when `b` precedes `a`. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const ms = fromLocalDate(b).getTime() - fromLocalDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isSameDay(a: LocalDate, b: LocalDate): boolean {
  return a === b;
}

/** "Good morning" / "Good afternoon" / "Good evening" for the Home header (06.9). */
export function greetingFor(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatDayLabel(date: LocalDate): string {
  return fromLocalDate(date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** 'YYYY-MM' key for a month. */
export type MonthKey = string;

export function monthOf(date: LocalDate): MonthKey {
  return date.slice(0, 7);
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function formatMonthLabel(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * The month as calendar weeks, Monday first. Cells outside the month are
 * `null` so the grid keeps its shape without inventing days (06.12).
 */
export function buildMonthGrid(month: MonthKey): (LocalDate | null)[][] {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leading = (first.getDay() + 6) % 7; // Monday = 0

  const cells: (LocalDate | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${month}-${pad(day)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (LocalDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export function formatShortDay(date: LocalDate): string {
  return fromLocalDate(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
