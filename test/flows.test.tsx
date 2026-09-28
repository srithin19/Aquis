/**
 * End-to-end data flows through the real AppProvider, repositories and SQL.
 * A fake clock walks through a user's days: sign-in, a goal, drinks, removals,
 * midnight, a goal period ending, settings, sign-out and reset.
 */

import { act } from '@testing-library/react-native';

import { freshStart, mountApp, onboard, query, scheduled, settle } from './helpers';

const at = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m, 0).getTime();

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'], now: at(28, 10) });
  await freshStart();
});

afterEach(() => {
  jest.useRealTimers();
});

test('first launch: nothing stored, no profile, no goal', async () => {
  const app = await mountApp();
  expect(app.result.current.profile).toBeNull();
  expect(app.result.current.activeGoal).toBeNull();
  expect(app.result.current.consumedMl).toBe(0);
});

test('Continue with email creates a profile with a derived name', async () => {
  const app = await mountApp();
  await act(async () => {
    await app.result.current.signIn({ provider: 'email', email: 'sri@example.com' });
  });
  expect(app.result.current.profile).toMatchObject({ provider: 'email', email: 'sri@example.com', displayName: 'Sri' });
  expect(query('SELECT COUNT(*) AS n FROM user_profile')[0].n).toBe(1);
});

test('starting a goal stores it, stamps today and plans reminders showing the amount', async () => {
  const app = await mountApp();
  await onboard(app.result);
  const s = app.result.current;
  expect(s.activeGoal).toMatchObject({ dailyGoalMl: 2000, durationDays: 7, status: 'active' });
  expect(s.goalMl).toBe(2000);
  expect(s.goalDay).toBe(1);
  expect(query("SELECT goal_ml FROM daily_hydration WHERE date = '2026-09-28'")[0].goal_ml).toBe(2000);
  expect(scheduled().length).toBeGreaterThan(0);
  expect(scheduled()[0].content.body).toBe('0 ml of 2.0 L (0%) · 2.0 L to go');
  expect(s.nextReminderAt).not.toBeNull();
});

test('logging water updates the day, earns First Sip once, and re-plans reminders', async () => {
  const app = await mountApp();
  await onboard(app.result);
  await act(async () => {
    await app.result.current.logWater(250, 'quick_add');
  });
  await settle();
  const s = app.result.current;
  expect(s.consumedMl).toBe(250);
  expect(s.entries).toHaveLength(1);
  expect(s.moments.map((m) => (m.kind === 'badge' ? m.achievement.id : m.kind))).toEqual(['first_sip']);
  expect(query("SELECT consumed_ml, entry_count FROM daily_hydration WHERE date='2026-09-28'")[0]).toEqual({
    consumed_ml: 250,
    entry_count: 1,
  });
  // Next nudge: never within 90 minutes of the drink, and it carries the new total.
  const first = scheduled()[0];
  expect((first.trigger.date as Date).getTime() - at(28, 10)).toBeGreaterThanOrEqual(90 * 60_000);
  expect(first.content.body).toBe('250 ml of 2.0 L (13%) · 1.75 L to go');
});

test('a badge is celebrated once even when a log and a refresh race', async () => {
  const app = await mountApp();
  await onboard(app.result);
  await act(async () => {
    await Promise.all([app.result.current.logWater(250, 'quick_add'), app.result.current.refresh()]);
  });
  await settle();
  const firstSips = app.result.current.moments.filter((m) => m.kind === 'badge' && m.achievement.id === 'first_sip');
  expect(firstSips).toHaveLength(1);
  expect(query('SELECT COUNT(*) AS n FROM user_achievement')[0].n).toBe(1);
});

test('the minus button removes exactly that drink and the day recomputes', async () => {
  const app = await mountApp();
  await onboard(app.result);
  await act(async () => {
    await app.result.current.logWater(250, 'quick_add');
    await app.result.current.logWater(500, 'quick_add');
  });
  const first = app.result.current.entries[0];
  await act(async () => {
    await app.result.current.removeEntry(first.id);
  });
  expect(app.result.current.consumedMl).toBe(500);
  expect(app.result.current.entries.map((e) => e.amountMl)).toEqual([500]);
});

test('reaching the goal marks the day complete and stops reminders for today', async () => {
  const app = await mountApp();
  await onboard(app.result);
  await act(async () => {
    await app.result.current.logWater(1500, 'custom');
    await app.result.current.logWater(500, 'quick_add');
  });
  await settle();
  const s = app.result.current;
  expect(s.goalReached).toBe(true);
  expect(s.progress).toBe(1);
  expect(s.moments.some((m) => m.kind === 'badge' && m.achievement.id === 'first_goal')).toBe(true);
  expect(scheduled().every((n) => (n.trigger.date as Date).getDate() !== 28)).toBe(true);
  // Extra water still records, the target does not move.
  await act(async () => {
    await app.result.current.logWater(300, 'quick_add');
  });
  expect(app.result.current.consumedMl).toBe(2300);
  expect(app.result.current.goalMl).toBe(2000);
});

test('midnight: yesterday is kept for the calendar and Home starts again at 0', async () => {
  const app = await mountApp();
  await onboard(app.result);
  await act(async () => {
    await app.result.current.logWater(600, 'quick_add');
  });

  // The clock passes midnight while the app stays open.
  jest.setSystemTime(at(29, 0, 0) + 5_000);
  await act(async () => {
    jest.advanceTimersByTime(31_000);
  });
  await settle();

  const s = app.result.current;
  expect(s.today).toBe('2026-09-29');
  expect(s.consumedMl).toBe(0);
  expect(s.entries).toEqual([]);
  expect(s.goalDay).toBe(2);
  expect(query("SELECT consumed_ml FROM daily_hydration WHERE date='2026-09-28'")[0].consumed_ml).toBe(600);
});

test('a drink logged seconds after midnight goes to the new day, not yesterday’s list', async () => {
  const app = await mountApp();
  await onboard(app.result);
  await act(async () => {
    await app.result.current.logWater(600, 'quick_add');
  });
  jest.setSystemTime(at(29, 0, 0) + 2_000); // before the 30 s rollover check runs
  await act(async () => {
    await app.result.current.logWater(250, 'quick_add');
  });
  const s = app.result.current;
  expect(s.today).toBe('2026-09-29');
  expect(s.entries.map((e) => e.amountMl)).toEqual([250]);
  expect(s.consumedMl).toBe(250);
});

test('streak counts consecutive 100% days', async () => {
  const app = await mountApp();
  await onboard(app.result);
  for (const day of [28, 29, 30]) {
    jest.setSystemTime(at(day, 12));
    await act(async () => {
      await app.result.current.refresh();
    });
    await act(async () => {
      await app.result.current.logWater(2000, 'custom');
    });
    await settle();
  }
  expect(app.result.current.streak).toMatchObject({ current: 3, longest: 3 });
  expect(app.result.current.moments.some((m) => m.kind === 'streak' && m.length === 3)).toBe(true);
});

test('a goal period that ends short is closed as "ended" and summarised once', async () => {
  const app = await mountApp();
  await onboard(app.result, { dailyGoalMl: 2000, durationDays: 3 });
  await act(async () => {
    await app.result.current.logWater(2000, 'custom'); // day 1 hit, days 2–3 missed
  });
  jest.setSystemTime(at(31, 9));
  await act(async () => {
    await app.result.current.refresh();
  });
  await settle();

  const s = app.result.current;
  expect(s.activeGoal).toBeNull();
  expect(s.goalSummary).toMatchObject({ daysCompleted: 1, crushed: false });
  expect(query('SELECT status FROM goal')[0].status).toBe('ended');

  await act(async () => {
    await app.result.current.acknowledgeGoalSummary();
  });
  await act(async () => {
    await app.result.current.refresh();
  });
  expect(app.result.current.goalSummary).toBeNull();
});

test('a fully met goal period is "completed" and earns Goal Crusher', async () => {
  const app = await mountApp();
  await onboard(app.result, { dailyGoalMl: 1000, durationDays: 2 });
  for (const day of [28, 29]) {
    jest.setSystemTime(at(day, 12));
    await act(async () => {
      await app.result.current.refresh();
    });
    await act(async () => {
      await app.result.current.logWater(1000, 'custom');
    });
  }
  jest.setSystemTime(at(30, 9));
  await act(async () => {
    await app.result.current.refresh();
  });
  await settle();
  expect(query('SELECT status FROM goal')[0].status).toBe('completed');
  expect(app.result.current.goalSummary?.crushed).toBe(true);
  expect(app.result.current.earned.has('goal_crusher')).toBe(true);
});

test('changing the goal starts a new period and never rewrites past days', async () => {
  const app = await mountApp();
  await onboard(app.result, { dailyGoalMl: 2000, durationDays: 7 });
  await act(async () => {
    await app.result.current.logWater(1000, 'custom');
  });
  jest.setSystemTime(at(29, 9));
  await act(async () => {
    await app.result.current.refresh();
    await app.result.current.startGoal({ dailyGoalMl: 3000, durationDays: 7 });
  });
  expect(query("SELECT goal_ml, completion_percent FROM daily_hydration WHERE date='2026-09-28'")[0]).toEqual({
    goal_ml: 2000,
    completion_percent: 50,
  });
  expect(app.result.current.goalMl).toBe(3000);
  expect(query("SELECT COUNT(*) AS n FROM goal WHERE status='active'")[0].n).toBe(1);
});

test('turning reminders off cancels everything; quiet hours move the plan', async () => {
  const app = await mountApp();
  await onboard(app.result);
  await act(async () => {
    await app.result.current.updateSettings({ notificationsEnabled: false });
  });
  await settle();
  expect(scheduled()).toHaveLength(0);
  expect(app.result.current.nextReminderAt).toBeNull();

  await act(async () => {
    await app.result.current.updateSettings({ notificationsEnabled: true, quietStart: '11:00', quietEnd: '18:00' });
  });
  await settle();
  for (const n of scheduled()) {
    const h = (n.trigger.date as Date).getHours();
    expect(h >= 11 && h < 18).toBe(false);
  }
});

test('settings persist: quick-add amounts, haptics, reduce motion', async () => {
  const app = await mountApp();
  await onboard(app.result);
  await act(async () => {
    await app.result.current.updateSettings({ quickAddMl: [200, 300, 600], hapticsEnabled: false, reduceMotion: true });
  });
  expect(app.result.current.settings.quickAddMl).toEqual([200, 300, 600]);
  expect(app.result.current.reduceMotion).toBe(true);
  expect(query('SELECT quick_add_ml, haptics_enabled FROM app_settings')[0]).toEqual({
    quick_add_ml: '200,300,600',
    haptics_enabled: 0,
  });
});

test('sign out keeps history; reset wipes everything', async () => {
  const app = await mountApp();
  await onboard(app.result);
  await act(async () => {
    await app.result.current.logWater(250, 'quick_add');
    await app.result.current.signOut();
  });
  expect(app.result.current.profile).toBeNull();
  expect(query('SELECT COUNT(*) AS n FROM water_entry')[0].n).toBe(1);
  expect(scheduled()).toHaveLength(0);

  await act(async () => {
    await app.result.current.resetLocalData();
  });
  for (const table of ['water_entry', 'daily_hydration', 'goal', 'user_achievement', 'user_profile']) {
    // Today's empty placeholder row may be re-created by the reload; everything else is gone.
    const n = query(`SELECT COUNT(*) AS n FROM ${table}`)[0].n as number;
    expect(table === 'daily_hydration' ? n <= 1 : n === 0).toBe(true);
  }
  expect(app.result.current.moments).toEqual([]);
});
