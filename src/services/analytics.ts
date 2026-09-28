/**
 * Event taxonomy — Product Bible 14.
 *
 * "Even if the first release is local-only, define events early so future
 * analytics can be added consistently." Nothing leaves the device (17): in
 * development events are printed, in production they are dropped. Swapping in a
 * real sink later is a change to `sink` only.
 */

export interface AnalyticsEvents {
  app_opened: { appVersion: string };
  goal_created: { goalMl: number; durationDays: number };
  water_logged: { amountMl: number; source: string; timeSincePrevious: number | null };
  water_undo: { amountMl: number; secondsSinceLog: number };
  notification_scheduled: { count: number };
  notification_opened: { action: 'opened' | 'logged' };
  goal_completed: { durationDays: number; daysCompleted: number };
  goal_missed: { durationDays: number; finalCompletion: number };
  achievement_earned: { achievementId: string };
  streak_milestone: { streakLength: number };
}

type Sink = <K extends keyof AnalyticsEvents>(name: K, props: AnalyticsEvents[K] & { timestamp: number }) => void;

const sink: Sink = (name, props) => {
  if (__DEV__) console.log(`[analytics] ${name}`, props);
};

export function track<K extends keyof AnalyticsEvents>(name: K, props: AnalyticsEvents[K]): void {
  try {
    sink(name, { ...props, timestamp: Date.now() });
  } catch {
    /* Analytics must never break the product. */
  }
}
