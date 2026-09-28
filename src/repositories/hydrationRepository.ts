/**
 * Water entries and the per-day hydration record.
 *
 * Two rules from the Product Bible drive this file:
 *
 *  - 09: "Daily consumed amount is derived from entries, not stored as an
 *    independently editable truth." Every mutation recomputes the day's totals
 *    from `water_entry` inside the same transaction, so the droplet can never
 *    drift from the log.
 *  - 11: "Never recalculate an old day using today's goal." `goal_ml` belongs to
 *    the day it was recorded on. Only a row that has no real goal yet, or a day
 *    inside the current goal's own period, may take a new stamp — see
 *    `shouldStampGoalOnDay`.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/client';
import { todayLocal } from '@/domain/date';
import { shouldStampGoalOnDay } from '@/domain/goals';
import { completionPercent, isDayComplete } from '@/domain/hydration';
import type { DailyHydration, Goal, LocalDate, WaterEntry, WaterEntrySource } from '@/domain/types';
import { createId } from '@/utils/id';

interface EntryRow {
  id: string;
  date: string;
  amount_ml: number;
  logged_at: number;
  source: string;
  created_at: number;
}

interface DailyRow {
  date: string;
  goal_id: string | null;
  goal_ml: number;
  consumed_ml: number;
  completed: number;
  completion_percent: number;
  entry_count: number;
  first_entry_at: number | null;
  last_entry_at: number | null;
}

function toEntry(row: EntryRow): WaterEntry {
  return {
    id: row.id,
    date: row.date,
    amountMl: row.amount_ml,
    loggedAt: row.logged_at,
    source: row.source as WaterEntrySource,
    createdAt: row.created_at,
  };
}

function toDaily(row: DailyRow): DailyHydration {
  return {
    date: row.date,
    goalId: row.goal_id,
    goalMl: row.goal_ml,
    consumedMl: row.consumed_ml,
    completed: row.completed === 1,
    completionPercent: row.completion_percent,
    entryCount: row.entry_count,
    firstEntryAt: row.first_entry_at,
    lastEntryAt: row.last_entry_at,
  };
}

/**
 * Recomputes one day's totals from its entries. Must be called inside a
 * transaction that has already written the entry change.
 */
async function recalculateDay(db: SQLiteDatabase, date: LocalDate): Promise<void> {
  const totals = await db.getFirstAsync<{
    consumed: number | null;
    count: number;
    first_at: number | null;
    last_at: number | null;
  }>(
    `SELECT SUM(amount_ml) AS consumed,
            COUNT(*)       AS count,
            MIN(logged_at) AS first_at,
            MAX(logged_at) AS last_at
     FROM water_entry WHERE date = ?;`,
    [date],
  );

  const existing = await db.getFirstAsync<DailyRow>(
    'SELECT * FROM daily_hydration WHERE date = ?;',
    [date],
  );
  if (!existing) return;

  const consumedMl = totals?.consumed ?? 0;

  await db.runAsync(
    `UPDATE daily_hydration
        SET consumed_ml = ?, completion_percent = ?, completed = ?,
            entry_count = ?, first_entry_at = ?, last_entry_at = ?
      WHERE date = ?;`,
    [
      consumedMl,
      completionPercent(consumedMl, existing.goal_ml),
      isDayComplete(consumedMl, existing.goal_ml) ? 1 : 0,
      totals?.count ?? 0,
      totals?.first_at ?? null,
      totals?.last_at ?? null,
      date,
    ],
  );
}

/**
 * Creates the day's row if it does not exist yet, stamping the goal that
 * applies on that date.
 *
 * A row created before any goal existed carries `goal_ml = 0`, and today's row
 * predates a goal period that starts today. `shouldStampGoalOnDay` decides
 * which rows may adopt the current goal; every earlier day is left exactly as
 * it was recorded (section 11).
 *
 * Returns true when the stamp changed, so the caller can recompute the day
 * against its new target.
 */
async function ensureDayRow(
  db: SQLiteDatabase,
  date: LocalDate,
  goal: Goal | null,
): Promise<boolean> {
  await db.runAsync(
    `INSERT OR IGNORE INTO daily_hydration
       (date, goal_id, goal_ml, consumed_ml, completed, completion_percent, entry_count)
     VALUES (?, ?, ?, 0, 0, 0, 0);`,
    [date, goal?.id ?? null, goal?.dailyGoalMl ?? 0],
  );

  const row = await db.getFirstAsync<{ goal_id: string | null; goal_ml: number }>(
    'SELECT goal_id, goal_ml FROM daily_hydration WHERE date = ?;',
    [date],
  );
  if (!row) return false;

  const stamp = shouldStampGoalOnDay({
    date,
    rowGoalId: row.goal_id,
    rowGoalMl: row.goal_ml,
    goal,
  });
  if (!stamp || !goal) return false;

  await db.runAsync('UPDATE daily_hydration SET goal_id = ?, goal_ml = ? WHERE date = ?;', [
    goal.id,
    goal.dailyGoalMl,
    date,
  ]);
  return true;
}

export async function getDailyRecord(date: LocalDate): Promise<DailyHydration | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DailyRow>('SELECT * FROM daily_hydration WHERE date = ?;', [
    date,
  ]);
  return row ? toDaily(row) : null;
}

/**
 * The day's record, materialised against the given goal if the user has not
 * logged anything yet. Home calls this on open, so day rollover is handled the
 * moment the app is foregrounded.
 */
export async function ensureDailyRecord(
  date: LocalDate,
  goal: Goal | null,
): Promise<DailyHydration> {
  const db = await getDatabase();
  const restamped = await ensureDayRow(db, date, goal);
  if (restamped) await recalculateDay(db, date);
  const row = await db.getFirstAsync<DailyRow>('SELECT * FROM daily_hydration WHERE date = ?;', [
    date,
  ]);
  return toDaily(row as DailyRow);
}

export async function listEntriesForDate(date: LocalDate): Promise<WaterEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<EntryRow>(
    'SELECT * FROM water_entry WHERE date = ? ORDER BY logged_at ASC;',
    [date],
  );
  return rows.map(toEntry);
}

export interface LogWaterInput {
  amountMl: number;
  source: WaterEntrySource;
  goal: Goal | null;
  date?: LocalDate;
  loggedAt?: number;
}

export interface LogWaterResult {
  entry: WaterEntry;
  daily: DailyHydration;
  /** True only on the logging action that crossed the target (06.11). */
  justCompleted: boolean;
}

export async function logWater(input: LogWaterInput): Promise<LogWaterResult> {
  const db = await getDatabase();
  const date = input.date ?? todayLocal();
  const loggedAt = input.loggedAt ?? Date.now();

  const entry: WaterEntry = {
    id: createId('wtr'),
    date,
    amountMl: input.amountMl,
    loggedAt,
    source: input.source,
    createdAt: loggedAt,
  };

  const before = await getDailyRecord(date);

  await db.withTransactionAsync(async () => {
    await ensureDayRow(db, date, input.goal);
    await db.runAsync(
      `INSERT INTO water_entry (id, date, amount_ml, logged_at, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [entry.id, entry.date, entry.amountMl, entry.loggedAt, entry.source, entry.createdAt],
    );
    await recalculateDay(db, date);
  });

  const daily = (await getDailyRecord(date)) as DailyHydration;
  return { entry, daily, justCompleted: daily.completed && !(before?.completed ?? false) };
}

/**
 * Removes one entry and subtracts its amount from the day.
 *
 * 09 — "Undo is available immediately after logging. Entries are append-only in
 * normal operation; edits/deletes should be explicit." This is that one
 * explicit removal path: Home puts a minus control on every entry, so the drink
 * you just logged is the top row and any earlier one can be corrected too.
 */
export async function deleteEntry(entryId: string): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<EntryRow>('SELECT * FROM water_entry WHERE id = ?;', [entryId]);
  if (!row) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM water_entry WHERE id = ?;', [entryId]);
    await recalculateDay(db, row.date);
  });
}

/** Used by History (Phase 4) and by the goal-period summary. */
export async function listDailyRecords(from: LocalDate, to: LocalDate): Promise<DailyHydration[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DailyRow>(
    'SELECT * FROM daily_hydration WHERE date >= ? AND date <= ? ORDER BY date ASC;',
    [from, to],
  );
  return rows.map(toDaily);
}

export async function countTotalEntries(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM water_entry;',
  );
  return row?.count ?? 0;
}

export interface LifetimeTotals {
  totalEntries: number;
  totalMl: number;
  successfulDays: number;
}

export async function getLifetimeTotals(): Promise<LifetimeTotals> {
  const db = await getDatabase();
  const entries = await db.getFirstAsync<{ count: number; total: number | null }>(
    'SELECT COUNT(*) AS count, SUM(amount_ml) AS total FROM water_entry;',
  );
  const days = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM daily_hydration WHERE completed = 1;',
  );
  return {
    totalEntries: entries?.count ?? 0,
    totalMl: entries?.total ?? 0,
    successfulDays: days?.count ?? 0,
  };
}

/** How many calendar days have at least one drink recorded. */
export async function countDaysWithEntries(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM daily_hydration WHERE entry_count > 0;',
  );
  return row?.count ?? 0;
}

/** Every day's completion flag, oldest first — the input to streak maths (11). */
export async function listDayOutcomes(): Promise<{ date: LocalDate; completed: boolean }[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ date: string; completed: number }>(
    'SELECT date, completed FROM daily_hydration ORDER BY date ASC;',
  );
  return rows.map((row) => ({ date: row.date, completed: row.completed === 1 }));
}
