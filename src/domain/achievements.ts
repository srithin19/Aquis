/**
 * Badge catalogue and unlock rules — Product Bible 12.
 *
 * Every badge is a pure function of `AchievementStats`, which the provider
 * derives from authoritative records (entries, daily rows, goal periods). Once
 * earned, a badge is stored with its timestamp and never revoked — deleting an
 * entry later does not take a badge away.
 */

import { GLASS_EQUIVALENT_ML } from './hydration';

export interface AchievementStats {
  totalEntries: number;
  totalMl: number;
  successfulDays: number;
  longestStreak: number;
  /** Goal periods in which every single day reached 100%. */
  crushedGoals: number;
}

export type AchievementTint = 'aqua' | 'violet' | 'magenta' | 'lime' | 'amber';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  tint: AchievementTint;
  /** Progress toward the unlock, as [current, target]. */
  progress(stats: AchievementStats): [number, number];
}

const GLASSES_FOR_CENTURY = 100;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first_sip',
    name: 'First Sip',
    description: 'Log your first drink.',
    tint: 'aqua',
    progress: (s) => [Math.min(s.totalEntries, 1), 1],
  },
  {
    id: 'first_goal',
    name: 'First Goal',
    description: 'Reach 100% of a daily target.',
    tint: 'lime',
    progress: (s) => [Math.min(s.successfulDays, 1), 1],
  },
  {
    id: 'seven_day_flow',
    name: '7-Day Flow',
    description: 'Seven successful days in a row.',
    tint: 'violet',
    progress: (s) => [Math.min(s.longestStreak, 7), 7],
  },
  {
    id: 'thirty_day_flow',
    name: '30-Day Flow',
    description: 'Thirty successful days in a row.',
    tint: 'magenta',
    progress: (s) => [Math.min(s.longestStreak, 30), 30],
  },
  {
    id: 'hydration_habit',
    name: 'Hydration Habit',
    description: 'Log 100 drinks in total.',
    tint: 'aqua',
    progress: (s) => [Math.min(s.totalEntries, 100), 100],
  },
  {
    id: 'goal_crusher',
    name: 'Goal Crusher',
    description: 'Hit 100% on every day of a goal period.',
    tint: 'amber',
    progress: (s) => [Math.min(s.crushedGoals, 1), 1],
  },
  {
    id: 'century_of_glasses',
    name: 'Century of Glasses',
    description: `Drink ${GLASSES_FOR_CENTURY} glasses (${GLASS_EQUIVALENT_ML} ml each).`,
    tint: 'violet',
    progress: (s) => [
      Math.min(Math.floor(s.totalMl / GLASS_EQUIVALENT_ML), GLASSES_FOR_CENTURY),
      GLASSES_FOR_CENTURY,
    ],
  },
];

export function isEarned(def: AchievementDef, stats: AchievementStats): boolean {
  const [current, target] = def.progress(stats);
  return current >= target;
}

/** Badges that the stats satisfy but that are not yet stored as earned. */
export function newlyEarned(
  stats: AchievementStats,
  alreadyEarned: ReadonlySet<string>,
): AchievementDef[] {
  return ACHIEVEMENTS.filter((def) => !alreadyEarned.has(def.id) && isEarned(def, stats));
}

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((def) => def.id === id);
}
