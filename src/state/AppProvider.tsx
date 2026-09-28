/**
 * Application state — Product Bible 16.
 *
 * "Persistent domain state lives in the database. Transient UI state lives in
 * React state. Do not put every database field into a global store."
 *
 * So this provider holds exactly the slice every screen needs — profile,
 * settings, the one active goal, today's hydration, the streak and earned
 * badges — and exposes actions that write through the repositories and then
 * refresh from them. The database stays the single source of truth.
 *
 * After every change that can move the day (a log, a removal, a new goal, a
 * settings edit, the app coming to the foreground) three things are rebuilt
 * from authoritative records: the streak, the badges, and the reminder plan.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { resetDatabase } from '@/db/client';
import { achievementById, newlyEarned, type AchievementDef, type AchievementStats } from '@/domain/achievements';
import { todayLocal } from '@/domain/date';
import { goalDayNumber, hasGoalPeriodElapsed } from '@/domain/goals';
import { completionRatio, isDayComplete } from '@/domain/hydration';
import { computeStreak, isStreakMilestone } from '@/domain/streaks';
import type {
  AppSettings,
  DailyHydration,
  Goal,
  LocalDate,
  StreakState,
  UserProfile,
  WaterEntry,
  WaterEntrySource,
} from '@/domain/types';
import * as achievementRepository from '@/repositories/achievementRepository';
import * as goalRepository from '@/repositories/goalRepository';
import * as hydrationRepository from '@/repositories/hydrationRepository';
import { clearProfile } from '@/repositories/profileRepository';
import { getSettings, updateSettings as persistSettings } from '@/repositories/settingsRepository';
import { saveStreak } from '@/repositories/streakRepository';
import { track } from '@/services/analytics';
import { getAuthProvider, type SignInOutcome, type SignInRequest } from '@/services/authService';
import {
  cancelAllReminders,
  getPermission,
  setRemindersActive,
  requestPermission,
  syncReminders,
  type PermissionState,
} from '@/services/notificationService';
import { setSoundsEnabled } from '@/services/sound';
import { setHapticsEnabled } from '@/utils/haptics';
import { useSystemReduceMotion } from '@/utils/motion';

export interface LogWaterOutcome {
  justCompleted: boolean;
  daily: DailyHydration;
}

/** Something worth a celebration sheet: a new badge or a streak milestone. */
export type Moment =
  | { kind: 'badge'; achievement: AchievementDef }
  | { kind: 'streak'; length: number };

export interface GoalSummary {
  goal: Goal;
  daysCompleted: number;
  averagePercent: number;
  totalMl: number;
  crushed: boolean;
}

const EMPTY_STATS: AchievementStats = {
  totalEntries: 0,
  totalMl: 0,
  successfulDays: 0,
  longestStreak: 0,
  crushedGoals: 0,
};

const EMPTY_STREAK: StreakState = { current: 0, longest: 0, lastSuccessfulDate: null };

interface AppStateValue {
  /** False until the database, profile, settings and today's record are loaded. */
  ready: boolean;
  /** Set when bootstrap failed; screens show a retry rather than a blank app. */
  bootstrapError: string | null;

  profile: UserProfile | null;
  settings: AppSettings;
  activeGoal: Goal | null;
  today: LocalDate;
  daily: DailyHydration | null;
  entries: WaterEntry[];

  /** Derived for convenience — see Product Bible 09. */
  consumedMl: number;
  goalMl: number;
  progress: number;
  goalReached: boolean;
  goalDay: number;

  streak: StreakState;
  stats: AchievementStats;
  earned: Map<string, number>;
  /** Celebrations waiting to be shown, oldest first. */
  moments: Moment[];
  dismissMoment(): void;

  /** A goal period that ended and has not been summarised yet (04). */
  goalSummary: GoalSummary | null;
  acknowledgeGoalSummary(): Promise<void>;

  notificationPermission: PermissionState;
  /** The soonest scheduled reminder, if any. */
  nextReminderAt: number | null;
  /** OS preference OR the in-app toggle. */
  reduceMotion: boolean;
  /** The phone's own Reduce Motion setting — shown in Profile so it is never a mystery. */
  systemReduceMotion: boolean;
  /** Bumped on every data change so screens reading the database can refetch. */
  revision: number;

  /** Google or email. Resolves to what happened — signed in, cancelled, or why not. */
  signIn(request: SignInRequest): Promise<SignInOutcome>;
  signOut(): Promise<void>;
  startGoal(input: { dailyGoalMl: number; durationDays: number }): Promise<Goal>;
  logWater(amountMl: number, source: WaterEntrySource): Promise<LogWaterOutcome>;
  /** Removes one entry, subtracting its amount from the day. */
  removeEntry(entryId: string): Promise<void>;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  /** Asks for the OS permission (after explanation) and turns reminders on or off. */
  setRemindersEnabled(enabled: boolean): Promise<PermissionState>;
  resetLocalData(): Promise<void>;
  refresh(): Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const FALLBACK_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  quietStart: '22:00',
  quietEnd: '07:00',
  reduceMotion: false,
  hapticsEnabled: true,
  soundsEnabled: true,
  quickAddMl: [150, 250, 500],
  postGoalRemindersEnabled: false,
  onboardingCompleted: false,
};

async function summarise(goal: Goal): Promise<GoalSummary> {
  const records = await hydrationRepository.listDailyRecords(goal.startDate, goal.endDate);
  const daysCompleted = records.filter((r) => r.completed).length;
  const percentSum = records.reduce((sum, r) => sum + r.completionPercent, 0);
  return {
    goal,
    daysCompleted,
    averagePercent: Math.round(percentSum / Math.max(goal.durationDays, 1)),
    totalMl: records.reduce((sum, r) => sum + r.consumedMl, 0),
    crushed: daysCompleted >= goal.durationDays,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings>(FALLBACK_SETTINGS);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [today, setToday] = useState<LocalDate>(todayLocal());
  const [daily, setDaily] = useState<DailyHydration | null>(null);
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [stats, setStats] = useState<AchievementStats>(EMPTY_STATS);
  const [earned, setEarned] = useState<Map<string, number>>(new Map());
  const [moments, setMoments] = useState<Moment[]>([]);
  const [goalSummary, setGoalSummary] = useState<GoalSummary | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<PermissionState>('undetermined');
  const [revision, setRevision] = useState(0);
  const [nextReminderAt, setNextReminderAt] = useState<number | null>(null);

  const systemReduceMotion = useSystemReduceMotion();
  /** The newest state, for actions that must not act on a stale render. */
  const latest = useRef({ settings, activeGoal, daily, entries, today });
  latest.current = { settings, activeGoal, daily, entries, today };
  const streakRef = useRef(0);
  /** The first evaluation only sets the baseline — an existing streak is not a new milestone. */
  const primedRef = useRef(false);

  /** Keys of every moment already queued, so nothing is ever celebrated twice. */
  const celebratedRef = useRef(new Set<string>());
  const evaluationQueue = useRef<Promise<void>>(Promise.resolve());

  /**
   * Streak + badges, rebuilt from records. Queues celebrations for anything new.
   *
   * Runs strictly one at a time: a log and an app-foreground refresh can fire
   * together, and two overlapping runs would each see the badge as unearned
   * and each queue it — the double "First Sip" popup.
   */
  const evaluateMotivation = useCallback((date: LocalDate) => {
    const run = evaluationQueue.current.then(() => evaluateOnce(date));
    evaluationQueue.current = run.catch(() => {});
    return run;
    // evaluateOnce only touches refs, setters and repositories — all stable.
  }, []);

  const evaluateOnce = async (date: LocalDate) => {
    const [totals, outcomes, crushedGoals, earnedRows] = await Promise.all([
      hydrationRepository.getLifetimeTotals(),
      hydrationRepository.listDayOutcomes(),
      goalRepository.countCrushedGoals(),
      achievementRepository.listEarned(),
    ]);

    const nextStreak = computeStreak(outcomes, date);
    await saveStreak(nextStreak);

    const nextStats: AchievementStats = {
      ...totals,
      longestStreak: nextStreak.longest,
      crushedGoals,
    };

    const earnedMap = new Map(earnedRows.map((row) => [row.achievementId, row.earnedAt]));
    const fresh = newlyEarned(nextStats, new Set(earnedMap.keys()));
    if (fresh.length > 0) {
      const now = Date.now();
      await achievementRepository.award(fresh.map((def) => def.id), now);
      for (const def of fresh) {
        earnedMap.set(def.id, now);
        track('achievement_earned', { achievementId: def.id });
      }
    }

    const newMoments: Moment[] = fresh.map((achievement) => ({ kind: 'badge', achievement }));
    if (
      primedRef.current &&
      nextStreak.current > streakRef.current &&
      isStreakMilestone(nextStreak.current)
    ) {
      newMoments.push({ kind: 'streak', length: nextStreak.current });
      track('streak_milestone', { streakLength: nextStreak.current });
    }
    streakRef.current = nextStreak.current;
    primedRef.current = true;

    const unseen = newMoments.filter((moment) => {
      const momentKey = moment.kind === 'badge' ? moment.achievement.id : `streak-${moment.length}`;
      if (celebratedRef.current.has(momentKey)) return false;
      celebratedRef.current.add(momentKey);
      return true;
    });

    setStreak(nextStreak);
    setStats(nextStats);
    setEarned(earnedMap);
    if (unseen.length > 0) setMoments((current) => [...current, ...unseen]);
  };

  /** Rebuild the reminder plan from the state that was just written (10). */
  const resync = useCallback(
    async (next: {
      settings: AppSettings;
      goal: Goal | null;
      daily: DailyHydration | null;
      entries: WaterEntry[];
    }) => {
      try {
        const permission = await getPermission();
        setNotificationPermission(permission);
        const goalMl = next.daily?.goalMl || next.goal?.dailyGoalMl || 0;
        const times = await syncReminders({
          enabled: next.settings.notificationsEnabled && next.goal !== null,
          lastDrinkAt: next.entries.length > 0 ? next.entries[next.entries.length - 1].loggedAt : null,
          goalReachedToday: isDayComplete(next.daily?.consumedMl ?? 0, goalMl),
          postGoalReminders: next.settings.postGoalRemindersEnabled,
          quietStart: next.settings.quietStart,
          quietEnd: next.settings.quietEnd,
          consumedMl: next.daily?.consumedMl ?? 0,
          goalMl,
          // No nudges after the goal period's last day (they would point at a
          // goal that has already closed).
          lastDay: next.goal?.endDate ?? null,
          sound: next.settings.soundsEnabled,
        });
        setNextReminderAt(times[0] ?? null);
        if (times.length > 0) track('notification_scheduled', { count: times.length });
      } catch {
        /* Reminders are best-effort; the app stays useful without them (20). */
      }
    },
    [],
  );

  /**
   * Single load path, used by bootstrap, by pull-to-refresh and by foregrounding.
   * Re-reading the date here is what makes midnight rollover safe.
   */
  const loadNow = useCallback(async () => {
    try {
      const [loadedSettings, loadedProfile] = await Promise.all([
        getSettings(),
        getAuthProvider().restore(),
      ]);

      let goal = await goalRepository.getActiveGoal();
      const date = todayLocal();

      // 11 — a goal period is frozen once its final day has passed, recorded as
      // it actually went: `completed` only if every day hit 100%.
      if (goal && hasGoalPeriodElapsed(goal, date)) {
        const result = await summarise(goal);
        await goalRepository.closeGoal(goal.id, result.crushed ? 'completed' : 'ended');
        if (result.crushed) {
          track('goal_completed', { durationDays: goal.durationDays, daysCompleted: result.daysCompleted });
        } else {
          track('goal_missed', { durationDays: goal.durationDays, finalCompletion: result.averagePercent });
        }
        goal = null;
      }

      const record = await hydrationRepository.ensureDailyRecord(date, goal);
      const dayEntries = await hydrationRepository.listEntriesForDate(date);
      const unseen = await goalRepository.getUnseenClosedGoal();

      setSettings(loadedSettings);
      setHapticsEnabled(loadedSettings.hapticsEnabled);
      setSoundsEnabled(loadedSettings.soundsEnabled);
      setProfile(loadedProfile);
      setActiveGoal(goal);
      setToday(date);
      setDaily(record);
      setEntries(dayEntries);
      setGoalSummary(unseen ? await summarise(unseen) : null);
      setBootstrapError(null);
      setRevision((r) => r + 1);
      // Actions that run right after a load must see what it found, even
      // before React re-renders.
      latest.current = {
        ...latest.current,
        settings: loadedSettings,
        activeGoal: goal,
        daily: record,
        entries: dayEntries,
        today: date,
      };

      await evaluateMotivation(date);
      if (loadedProfile) {
        setRemindersActive(true);
        void resync({ settings: loadedSettings, goal, daily: record, entries: dayEntries });
      }
    } catch (error) {
      setBootstrapError(error instanceof Error ? error.message : 'Could not open local storage.');
    } finally {
      setReady(true);
    }
  }, [evaluateMotivation, resync]);

  const loadQueue = useRef<Promise<void>>(Promise.resolve());
  const loadWaiting = useRef(false);

  /**
   * Loads run one at a time, and a call never returns before a load that
   * *started after it* has finished, so "reset, then reload" really reloads
   * and a foreground refresh can't land stale data on top of a fresh write.
   * Calls made while one is already waiting share it.
   */
  const load = useCallback((): Promise<void> => {
    if (loadWaiting.current) return loadQueue.current;
    loadWaiting.current = true;
    const run = loadQueue.current.then(() => {
      loadWaiting.current = false;
      return loadNow();
    });
    loadQueue.current = run.catch(() => {});
    return run;
  }, [loadNow]);

  useEffect(() => {
    track('app_opened', { appVersion: '1.0.0' });
    void load();
  }, [load]);

  // 20 — "The app handles missing data, app restarts and date changes safely."
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') void load();
    });
    return () => subscription.remove();
  }, [load]);

  // Midnight while the app stays open: roll the day over without a relaunch.
  useEffect(() => {
    const timer = setInterval(() => {
      if (todayLocal() !== today) void load();
    }, 30_000);
    return () => clearInterval(timer);
  }, [today, load]);

  const refreshToday = useCallback(async (goal: Goal | null) => {
    const date = todayLocal();
    const record = await hydrationRepository.ensureDailyRecord(date, goal);
    const dayEntries = await hydrationRepository.listEntriesForDate(date);
    setToday(date);
    setDaily(record);
    setEntries(dayEntries);
    return { record, dayEntries };
  }, []);

  const signIn = useCallback(async (request: SignInRequest) => {
    const outcome = await getAuthProvider().signIn(request);
    if (outcome.status !== 'signed-in') return outcome;
    setRemindersActive(true);
    setProfile(outcome.profile);
    // Signing back in with a goal still running: bring its reminders back.
    if (latest.current.activeGoal) void load();
    return outcome;
  }, [load]);

  const signOut = useCallback(async () => {
    await cancelAllReminders();
    setNextReminderAt(null);
    await getAuthProvider().signOut();
    await clearProfile();
    setProfile(null);
  }, []);

  const startGoal = useCallback(
    async (input: { dailyGoalMl: number; durationDays: number }) => {
      const goal = await goalRepository.createGoal(input);
      track('goal_created', { goalMl: input.dailyGoalMl, durationDays: input.durationDays });
      setActiveGoal(goal);
      const { record, dayEntries } = await refreshToday(goal);
      setRevision((r) => r + 1);
      const loadedSettings = await getSettings();
      void resync({ settings: loadedSettings, goal, daily: record, entries: dayEntries });
      return goal;
    },
    [refreshToday, resync],
  );

  const logWater = useCallback(
    async (amountMl: number, source: WaterEntrySource): Promise<LogWaterOutcome> => {
      // Never interleave with a refresh that read the day before this write.
      await loadQueue.current;
      // Past midnight since the last refresh: close a finished goal and open
      // the new day first, so the drink is not credited to yesterday's goal.
      if (todayLocal() !== latest.current.today) await load();
      const { activeGoal: goal, settings: currentSettings } = latest.current;
      const result = await hydrationRepository.logWater({ amountMl, source, goal });
      // Re-read the day from the database rather than appending to the list
      // this callback closed over: two logs close together (a quick-add and a
      // notification action, say) would otherwise drop one from the list. The
      // entry's own date also handles midnight — a drink seconds after 12 AM
      // starts the new day's list, not yesterday's.
      const nextEntries = await hydrationRepository.listEntriesForDate(result.entry.date);
      const previous = nextEntries.length > 1 ? nextEntries[nextEntries.length - 2].loggedAt : null;
      setToday(result.entry.date);
      setDaily(result.daily);
      setEntries(nextEntries);
      setRevision((r) => r + 1);
      track('water_logged', {
        amountMl,
        source,
        timeSincePrevious: previous ? result.entry.loggedAt - previous : null,
      });

      void evaluateMotivation(result.entry.date).catch(() => {});
      // 20 — "Rescheduling after water logs."
      void resync({ settings: currentSettings, goal, daily: result.daily, entries: nextEntries });
      return { justCompleted: result.justCompleted, daily: result.daily };
    },
    [evaluateMotivation, resync, load],
  );

  const removeEntry = useCallback(
    async (entryId: string) => {
      await loadQueue.current;
      const entry = entries.find((e) => e.id === entryId);
      await hydrationRepository.deleteEntry(entryId);
      const record = await hydrationRepository.getDailyRecord(today);
      const nextEntries = await hydrationRepository.listEntriesForDate(today);
      if (record) setDaily(record);
      setEntries(nextEntries);
      setRevision((r) => r + 1);
      if (entry) {
        track('water_undo', {
          amountMl: entry.amountMl,
          secondsSinceLog: Math.round((Date.now() - entry.loggedAt) / 1000),
        });
      }
      void evaluateMotivation(today).catch(() => {});
      void resync({ settings, goal: activeGoal, daily: record, entries: nextEntries });
    },
    [entries, today, settings, activeGoal, evaluateMotivation, resync],
  );

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = await persistSettings(patch);
      setSettings(next);
      setHapticsEnabled(next.hapticsEnabled);
      setSoundsEnabled(next.soundsEnabled);
      const touchesReminders =
        patch.notificationsEnabled !== undefined ||
        patch.quietStart !== undefined ||
        patch.quietEnd !== undefined ||
        patch.postGoalRemindersEnabled !== undefined ||
        // The notification sound follows the Sounds switch too.
        patch.soundsEnabled !== undefined;
      if (touchesReminders) {
        const { activeGoal: goal, daily: day, entries: list } = latest.current;
        void resync({ settings: next, goal, daily: day, entries: list });
      }
    },
    [resync],
  );

  const setRemindersEnabled = useCallback(
    async (enabled: boolean) => {
      let permission: PermissionState = await getPermission();
      if (enabled) permission = await requestPermission();
      setNotificationPermission(permission);
      await updateSettings({ notificationsEnabled: enabled });
      return permission;
    },
    [updateSettings],
  );

  const dismissMoment = useCallback(() => setMoments((current) => current.slice(1)), []);

  const acknowledgeGoalSummary = useCallback(async () => {
    if (!goalSummary) return;
    await goalRepository.markSummarySeen(goalSummary.goal.id);
    setGoalSummary(null);
  }, [goalSummary]);

  const resetLocalData = useCallback(async () => {
    await cancelAllReminders();
    await resetDatabase();
    setProfile(null);
    setActiveGoal(null);
    setDaily(null);
    setEntries([]);
    setMoments([]);
    setGoalSummary(null);
    streakRef.current = 0;
    primedRef.current = false;
    celebratedRef.current.clear();
    setNextReminderAt(null);
    setSettings(FALLBACK_SETTINGS);
    await load();
  }, [load]);

  const value = useMemo<AppStateValue>(() => {
    // `||` not `??`: a stored 0 is an unstamped placeholder, not a real target.
    // Left as `??` this froze the whole screen at 0% - see shouldStampGoalOnDay.
    const goalMl = daily?.goalMl || activeGoal?.dailyGoalMl || 0;
    const consumedMl = daily?.consumedMl ?? 0;

    return {
      ready,
      bootstrapError,
      profile,
      settings,
      activeGoal,
      today,
      daily,
      entries,
      consumedMl,
      goalMl,
      progress: completionRatio(consumedMl, goalMl),
      goalReached: isDayComplete(consumedMl, goalMl),
      goalDay: activeGoal ? goalDayNumber(activeGoal, today) : 0,
      streak,
      stats,
      earned,
      moments,
      dismissMoment,
      goalSummary,
      acknowledgeGoalSummary,
      notificationPermission,
      nextReminderAt,
      reduceMotion: systemReduceMotion || settings.reduceMotion,
      systemReduceMotion,
      revision,
      signIn,
      signOut,
      startGoal,
      logWater,
      removeEntry,
      updateSettings,
      setRemindersEnabled,
      resetLocalData,
      refresh: load,
    };
  }, [
    ready,
    bootstrapError,
    profile,
    settings,
    activeGoal,
    today,
    daily,
    entries,
    streak,
    stats,
    earned,
    moments,
    dismissMoment,
    goalSummary,
    acknowledgeGoalSummary,
    notificationPermission,
    nextReminderAt,
    systemReduceMotion,
    revision,
    signIn,
    signOut,
    startGoal,
    logWater,
    removeEntry,
    updateSettings,
    setRemindersEnabled,
    resetLocalData,
    load,
  ]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside <AppProvider>.');
  return value;
}

export { achievementById };
