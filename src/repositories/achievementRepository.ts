import { getDatabase } from '@/db/client';

export interface EarnedAchievement {
  achievementId: string;
  earnedAt: number;
}

export async function listEarned(): Promise<EarnedAchievement[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ achievement_id: string; earned_at: number }>(
    'SELECT achievement_id, earned_at FROM user_achievement ORDER BY earned_at DESC;',
  );
  return rows.map((row) => ({ achievementId: row.achievement_id, earnedAt: row.earned_at }));
}

/** Idempotent: a badge is earned once and keeps its first timestamp. */
export async function award(ids: readonly string[], now = Date.now()): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync(
        'INSERT OR IGNORE INTO user_achievement (achievement_id, earned_at) VALUES (?, ?);',
        [id, now],
      );
    }
  });
}
