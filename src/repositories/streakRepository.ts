/**
 * The persisted streak snapshot (13, `Streak`). It is always rewritten from
 * `computeStreak` over the daily records, so it can never drift from them.
 */

import { getDatabase } from '@/db/client';
import type { StreakState } from '@/domain/types';

export async function saveStreak(state: StreakState): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO streak_state (id, current, longest, last_successful_date) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET current = excluded.current, longest = excluded.longest,
       last_successful_date = excluded.last_successful_date;`,
    [state.current, state.longest, state.lastSuccessfulDate],
  );
}
