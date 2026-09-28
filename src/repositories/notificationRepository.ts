/**
 * Notification events (13, `NotificationEvent`).
 *
 * One row per planned reminder. A rebuilt plan deletes the rows it cancelled
 * (future and never shown), so a row whose time has passed is a reminder that
 * was actually delivered — which is what the daily cap counts.
 */

import { getDatabase } from '@/db/client';
import type { PlannedReminder } from '@/domain/notifications';
import type { LocalDate } from '@/domain/types';

export type NotificationAction = 'opened' | 'dismissed' | 'logged';

export async function replacePlanned(
  plan: readonly (PlannedReminder & { id: string })[],
  now = Date.now(),
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM notification_event WHERE scheduled_at > ? AND shown_at IS NULL AND action IS NULL;',
      [now],
    );
    for (const item of plan) {
      await db.runAsync(
        `INSERT OR REPLACE INTO notification_event (id, scheduled_at, shown_at, action, related_date, reason)
         VALUES (?, ?, NULL, NULL, ?, ?);`,
        [item.id, item.at, item.date, item.reason],
      );
    }
  });
}

export async function countDelivered(date: LocalDate, now = Date.now()): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM notification_event WHERE related_date = ? AND scheduled_at <= ?;',
    [date, now],
  );
  return row?.count ?? 0;
}

export async function markShown(id: string, at = Date.now()): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE notification_event SET shown_at = COALESCE(shown_at, ?) WHERE id = ?;', [at, id]);
}

export async function markAction(id: string, action: NotificationAction, at = Date.now()): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE notification_event SET action = ?, shown_at = COALESCE(shown_at, ?) WHERE id = ?;',
    [action, at, id],
  );
}

/** Drops every future plan row — used when reminders are switched off. */
export async function clearPlanned(now = Date.now()): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM notification_event WHERE scheduled_at > ? AND shown_at IS NULL AND action IS NULL;',
    [now],
  );
}
