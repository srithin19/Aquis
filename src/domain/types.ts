/**
 * Domain entities — Product Bible 13.
 *
 * Dates that identify a *day* are stored as 'YYYY-MM-DD' local-date keys.
 * Instants are stored as epoch milliseconds (UTC) so a future backend can sync
 * without rewriting the model (13 — "Future sync readiness").
 */

export type LocalDate = string; // 'YYYY-MM-DD'
export type Millis = number; // epoch ms, UTC

export type GoalStatus = 'active' | 'completed' | 'ended';

export interface UserProfile {
  id: string;
  displayName: string | null;
  email: string | null;
  provider: AuthProvider;
  createdAt: Millis;
}

export type AuthProvider = 'local' | 'google' | 'email';

export interface Goal {
  id: string;
  dailyGoalMl: number;
  startDate: LocalDate;
  endDate: LocalDate;
  durationDays: number;
  status: GoalStatus;
  createdAt: Millis;
  /** Reserved for the V2 "Suggest my goal" flow (06.4). */
  recommendationSource: string | null;
}

export interface WaterEntry {
  id: string;
  date: LocalDate;
  amountMl: number;
  /** When the user logged it. */
  loggedAt: Millis;
  source: WaterEntrySource;
  createdAt: Millis;
}

export type WaterEntrySource = 'quick_add' | 'custom' | 'notification';

/**
 * One row per day the user has been active. `goalMl` is frozen at write time —
 * Product Bible 11, "Historical integrity rule": never recalculate an old day
 * using today's goal.
 */
export interface DailyHydration {
  date: LocalDate;
  goalId: string | null;
  goalMl: number;
  consumedMl: number;
  completed: boolean;
  completionPercent: number;
  entryCount: number;
  firstEntryAt: Millis | null;
  lastEntryAt: Millis | null;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  /** 'HH:mm' local wall-clock. Quiet hours may wrap past midnight. */
  quietStart: string;
  quietEnd: string;
  reduceMotion: boolean;
  hapticsEnabled: boolean;
  /** In-app sound effects and the notification sound. */
  soundsEnabled: boolean;
  /** Quick-add buttons on Home (06.9). Stored as an ordered ml list. */
  quickAddMl: number[];
  postGoalRemindersEnabled: boolean;
  onboardingCompleted: boolean;
}

export interface ContainerPreset {
  id: string;
  name: string;
  volumeMl: number;
  enabled: boolean;
}

export interface StreakState {
  current: number;
  longest: number;
  lastSuccessfulDate: LocalDate | null;
}
