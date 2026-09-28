import assert from 'node:assert/strict';

import { addDays, daysBetween, toLocalDate, fromLocalDate } from '../src/domain/date';
import {
  completionPercent,
  completionRatio,
  formatVolume,
  isDayComplete,
  remainingMl,
  validateEntryAmount,
  validateGoalAmount,
} from '../src/domain/hydration';
import {
  buildGoalPeriod,
  goalDayNumber,
  hasGoalPeriodElapsed,
  isDateInGoalPeriod,
  shouldStampGoalOnDay,
} from '../src/domain/goals';
import { buildMonthGrid } from '../src/domain/date';
import { ACHIEVEMENTS, newlyEarned, type AchievementStats } from '../src/domain/achievements';
import { computeStreak } from '../src/domain/streaks';
import { crossedMilestone, mascotLine, selectMascotState, tapLine } from '../src/domain/mascot';
import {
  isQuietTime,
  MIN_GAP_AFTER_DRINK_MS,
  MIN_LEAD_MS,
  planReminders,
  reminderBody,
  type ReminderPlanInput,
} from '../src/domain/notifications';

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
};

console.log('Product Bible 09 — hydration maths');

check('worked example: 250+500+250+300 of 2500 => 52%', () => {
  const consumed = 250 + 500 + 250 + 300;
  assert.equal(consumed, 1300);
  assert.equal(completionPercent(consumed, 2500), 52);
});

check('glass clamps at 100% while data keeps recording', () => {
  assert.equal(completionRatio(4000, 2000), 1);
  assert.equal(completionPercent(4000, 2000), 100);
  assert.equal(remainingMl(4000, 2000), 0);
});

check('a day completes at exactly 100%, not before', () => {
  assert.equal(isDayComplete(1999, 2000), false);
  assert.equal(isDayComplete(2000, 2000), true);
  assert.equal(isDayComplete(2001, 2000), true);
});

check('zero goal never divides by zero', () => {
  assert.equal(completionRatio(500, 0), 0);
  assert.equal(isDayComplete(500, 0), false);
});

check('entry validation rejects junk, zero and absurd amounts', () => {
  assert.equal(validateEntryAmount('abc').ok, false);
  assert.equal(validateEntryAmount('0').ok, false);
  assert.equal(validateEntryAmount('-50').ok, false);
  assert.equal(validateEntryAmount('99999').ok, false);
  assert.deepEqual(validateEntryAmount('250').value, 250);
  assert.deepEqual(validateEntryAmount(' 330 ').value, 330);
});

check('goal validation holds the documented bounds', () => {
  assert.equal(validateGoalAmount('100').ok, false);
  assert.equal(validateGoalAmount('9000').ok, false);
  assert.equal(validateGoalAmount('2500').value, 2500);
});

check('volume formatting switches at a litre', () => {
  assert.equal(formatVolume(750), '750 ml');
  assert.equal(formatVolume(2000), '2.0 L');
  assert.equal(formatVolume(2500), '2.5 L');
});

console.log('\nProduct Bible 11 — goal periods');

check('a 3-day goal starting today ends on day 3, inclusive', () => {
  const goal = buildGoalPeriod({ dailyGoalMl: 2000, durationDays: 3, startDate: '2026-09-21' }, 'g1');
  assert.equal(goal.startDate, '2026-09-21');
  assert.equal(goal.endDate, '2026-09-23');
  assert.equal(goal.status, 'active');
});

check('day numbering is 1-based and clamped to the period', () => {
  const goal = buildGoalPeriod({ dailyGoalMl: 2000, durationDays: 7, startDate: '2026-09-21' }, 'g2');
  assert.equal(goalDayNumber(goal, '2026-09-21'), 1);
  assert.equal(goalDayNumber(goal, '2026-09-24'), 4);
  assert.equal(goalDayNumber(goal, '2026-09-27'), 7);
  assert.equal(goalDayNumber(goal, '2026-10-05'), 7, 'clamps past the end');
  assert.equal(goalDayNumber(goal, '2026-09-01'), 1, 'clamps before the start');
});

check('period membership and elapse are exact at the boundaries', () => {
  const goal = buildGoalPeriod({ dailyGoalMl: 2000, durationDays: 7, startDate: '2026-09-21' }, 'g3');
  assert.equal(isDateInGoalPeriod(goal, '2026-09-20'), false);
  assert.equal(isDateInGoalPeriod(goal, '2026-09-21'), true);
  assert.equal(isDateInGoalPeriod(goal, '2026-09-27'), true);
  assert.equal(isDateInGoalPeriod(goal, '2026-09-28'), false);

  assert.equal(hasGoalPeriodElapsed(goal, '2026-09-27'), false, 'final day is still live');
  assert.equal(hasGoalPeriodElapsed(goal, '2026-09-28'), true);
});

console.log('\nGoal stamping on a day record');

const stampGoal = buildGoalPeriod(
  { dailyGoalMl: 2000, durationDays: 7, startDate: '2026-09-21' },
  'goal-new',
);

check('regression: a placeholder written before any goal adopts the new goal', () => {
  // The app materialises today's row on launch, so a first run stores
  // goal_ml = 0 before onboarding produces a goal. Left unstamped, the glass
  // never fills and "still to go" is frozen at zero.
  assert.equal(
    shouldStampGoalOnDay({
      date: '2026-09-21',
      rowGoalId: null,
      rowGoalMl: 0,
      goal: stampGoal,
    }),
    true,
  );
});

check("today's row adopts a goal period that starts today", () => {
  assert.equal(
    shouldStampGoalOnDay({
      date: '2026-09-21',
      rowGoalId: 'goal-old',
      rowGoalMl: 1500,
      goal: stampGoal,
    }),
    true,
  );
});

check('a day before the goal period is never re-stamped', () => {
  assert.equal(
    shouldStampGoalOnDay({
      date: '2026-09-20',
      rowGoalId: 'goal-old',
      rowGoalMl: 1500,
      goal: stampGoal,
    }),
    false,
    'history keeps the target that applied on the day',
  );
});

check('an already-correct row is left alone', () => {
  assert.equal(
    shouldStampGoalOnDay({
      date: '2026-09-21',
      rowGoalId: stampGoal.id,
      rowGoalMl: 2000,
      goal: stampGoal,
    }),
    false,
  );
});

check('no goal means no stamp', () => {
  assert.equal(
    shouldStampGoalOnDay({ date: '2026-09-21', rowGoalId: null, rowGoalMl: 0, goal: null }),
    false,
  );
});

console.log('\nLocal-date handling (no UTC drift)');

check('a late-night local time stays on its own local day', () => {
  // 23:30 local on 21 Sep. toISOString() would roll this to the 22nd in any
  // timezone east of UTC-0:30.
  const lateNight = new Date(2026, 8, 21, 23, 30, 0);
  assert.equal(toLocalDate(lateNight), '2026-09-21');
});

check('an early-morning local time stays on its own local day', () => {
  const earlyMorning = new Date(2026, 8, 21, 0, 15, 0);
  assert.equal(toLocalDate(earlyMorning), '2026-09-21');
});

check('date arithmetic survives a month boundary and a DST shift', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09', 'US DST spring-forward');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26', 'EU DST fall-back');
  assert.equal(daysBetween('2026-09-21', '2026-09-28'), 7);
  assert.equal(daysBetween('2026-09-28', '2026-09-21'), -7);
});

check('round-trips through Date without shifting', () => {
  for (const date of ['2026-01-01', '2026-03-08', '2026-06-15', '2026-10-25', '2026-12-31']) {
    assert.equal(toLocalDate(fromLocalDate(date)), date, `round-trip ${date}`);
  }
});


console.log('\nProduct Bible 11/12 — streaks');

const days = (spec: string, end: string) =>
  // spec is oldest → newest, one char per day ending at `end`: '1' success, '0' miss.
  spec.split('').map((c, i) => ({ date: addDays(end, i - spec.length + 1), completed: c === '1' }));

check('an unfinished today does not break the streak', () => {
  const s = computeStreak(days('1110', '2026-09-28'), '2026-09-28');
  assert.equal(s.current, 3);
});

check('a finished today extends it', () => {
  assert.equal(computeStreak(days('1111', '2026-09-28'), '2026-09-28').current, 4);
});

check('a missed yesterday resets the current streak but not the longest', () => {
  const s = computeStreak(days('11111001', '2026-09-28'), '2026-09-28');
  assert.equal(s.current, 1);
  assert.equal(s.longest, 5);
  assert.equal(s.lastSuccessfulDate, '2026-09-28');
});

check('a calendar gap with no record at all also breaks a run', () => {
  const records = [
    { date: '2026-09-20', completed: true },
    { date: '2026-09-21', completed: true },
    { date: '2026-09-24', completed: true },
  ];
  assert.equal(computeStreak(records, '2026-09-25').current, 1);
  assert.equal(computeStreak(records, '2026-09-25').longest, 2);
});

console.log('\nProduct Bible 12 — badges');

const zero: AchievementStats = {
  totalEntries: 0,
  totalMl: 0,
  successfulDays: 0,
  longestStreak: 0,
  crushedGoals: 0,
};

check('nothing is earned from nothing', () => {
  assert.equal(newlyEarned(zero, new Set()).length, 0);
});

check('first sip and first goal unlock on the first entry and first 100% day', () => {
  const ids = newlyEarned({ ...zero, totalEntries: 1, totalMl: 250, successfulDays: 1, longestStreak: 1 }, new Set()).map((d) => d.id);
  assert.deepEqual(ids.sort(), ['first_goal', 'first_sip']);
});

check('already-earned badges are never re-awarded', () => {
  const ids = newlyEarned({ ...zero, totalEntries: 5 }, new Set(['first_sip'])).map((d) => d.id);
  assert.deepEqual(ids, []);
});

check('streak and volume badges use their documented thresholds', () => {
  const at = (stats: Partial<AchievementStats>) =>
    new Set(newlyEarned({ ...zero, ...stats }, new Set()).map((d) => d.id));
  assert.equal(at({ longestStreak: 6 }).has('seven_day_flow'), false);
  assert.equal(at({ longestStreak: 7 }).has('seven_day_flow'), true);
  assert.equal(at({ totalEntries: 99 }).has('hydration_habit'), false);
  assert.equal(at({ totalEntries: 100 }).has('hydration_habit'), true);
  assert.equal(at({ totalMl: 24_999 }).has('century_of_glasses'), false);
  assert.equal(at({ totalMl: 25_000 }).has('century_of_glasses'), true);
  assert.equal(at({ crushedGoals: 1 }).has('goal_crusher'), true);
  assert.equal(ACHIEVEMENTS.length, 7);
});

console.log('\nProduct Bible 10 — reminder planning');

const at = (h: number, m = 0, day = 28) => new Date(2026, 8, day, h, m, 0).getTime();
const base: ReminderPlanInput = {
  now: at(10),
  enabled: true,
  lastDrinkAt: null,
  goalReachedToday: false,
  postGoalReminders: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  deliveredToday: 0,
  random: () => 0.5,
};

check('quiet hours wrap past midnight', () => {
  assert.equal(isQuietTime(at(23), '22:00', '07:00'), true);
  assert.equal(isQuietTime(at(3), '22:00', '07:00'), true);
  assert.equal(isQuietTime(at(7), '22:00', '07:00'), false);
  assert.equal(isQuietTime(at(12), '22:00', '07:00'), false);
  assert.equal(isQuietTime(at(12), '09:00', '09:00'), false, 'equal bounds = none');
});

check('disabled reminders plan nothing', () => {
  assert.deepEqual(planReminders({ ...base, enabled: false }), []);
});

check('never immediately after a drink, and inside a ~3-hour window', () => {
  const drink = at(10);
  const plan = planReminders({ ...base, now: drink + 60_000, lastDrinkAt: drink });
  const gap = plan[0].at - drink;
  assert.ok(gap >= MIN_GAP_AFTER_DRINK_MS, 'respects the minimum gap');
  assert.ok(gap >= 2.5 * 3600_000 && gap <= 3.25 * 3600_000, `gap was ${gap / 3600_000}h`);
});

check('randomized: different draws land at different times in the window', () => {
  const lo = planReminders({ ...base, lastDrinkAt: at(10), random: () => 0 })[0].at;
  const hi = planReminders({ ...base, lastDrinkAt: at(10), random: () => 0.999 })[0].at;
  assert.ok(hi - lo > 30 * 60_000);
});

check('nothing is ever planned inside quiet hours', () => {
  for (const r of [0, 0.3, 0.7, 0.999]) {
    const plan = planReminders({ ...base, now: at(18), lastDrinkAt: at(18), random: () => r });
    for (const item of plan) assert.equal(isQuietTime(item.at, '22:00', '07:00'), false);
  }
});

check('goal complete: nothing more today, resumes after waking tomorrow', () => {
  const plan = planReminders({ ...base, now: at(15), lastDrinkAt: at(15), goalReachedToday: true });
  assert.ok(plan.length > 0);
  assert.ok(plan.every((p) => p.date !== '2026-09-28'), 'no reminders left today');
  assert.ok(plan[0].at >= at(7, 0, 29), 'first one after quiet hours end');
});

check('optional post-goal reminders keep today open', () => {
  const plan = planReminders({
    ...base,
    now: at(12),
    lastDrinkAt: at(12),
    goalReachedToday: true,
    postGoalReminders: true,
  });
  assert.equal(plan[0].date, '2026-09-28');
});

check('the daily cap is honoured, counting what was already delivered', () => {
  const plan = planReminders({ ...base, now: at(8), deliveredToday: 5, dailyCap: 6 });
  assert.equal(plan.filter((p) => p.date === '2026-09-28').length, 1);
});

check('no backlog: returning after a long silence plans from now, not the past', () => {
  // Last drink at 07:00, user reappears at 16:00 — the missed 10:00 and 13:00
  // opportunities are not replayed.
  const now = at(16);
  const plan = planReminders({ ...base, now, lastDrinkAt: at(7) });
  assert.ok(plan.every((p) => p.at >= now + MIN_LEAD_MS));
  const soon = plan.filter((p) => p.at < now + 60 * 60_000);
  assert.ok(soon.length <= 1, 'at most one reminder in the next hour');
});

check('nothing is planned after the goal period’s last day', () => {
  const plan = planReminders({ ...base, now: at(10), lastDay: '2026-09-28' });
  assert.ok(plan.length > 0);
  assert.ok(plan.every((p) => p.date === '2026-09-28'));
});

check('consecutive reminders stay spaced out', () => {
  const plan = planReminders(base);
  for (let i = 1; i < plan.length; i += 1) {
    assert.ok(plan[i].at - plan[i - 1].at >= 2 * 3600_000, 'at least 2h apart');
  }
});

check('reminder text carries today’s amount, target and what is left', () => {
  assert.equal(
    reminderBody({ forToday: true, consumedMl: 1200, goalMl: 2500 }),
    '1.2 L of 2.5 L (48%) · 1.3 L to go',
  );
  assert.equal(
    reminderBody({ forToday: false, consumedMl: 1200, goalMl: 2500 }),
    'New day, fresh glass · 0 of 2.5 L',
    'a reminder for tomorrow does not carry today’s total',
  );
  assert.match(reminderBody({ forToday: true, consumedMl: 2600, goalMl: 2500 }), /bonus/);
});

console.log('\nProduct Bible 07 — mascot moods');

const noon = new Date(2026, 8, 28, 12, 0).getTime();

check('a drink plays gulp → grin, and grin turns excited near the finish', () => {
  assert.equal(selectMascotState({ goalReached: false, reaction: 'drink', now: noon }), 'drink');
  assert.equal(selectMascotState({ goalReached: false, reaction: 'happy', progress: 0.4, now: noon }), 'happy');
  assert.equal(selectMascotState({ goalReached: false, reaction: 'happy', progress: 0.8, now: noon }), 'excited');
});

check('goal complete: party first, then calm pride (not all-day jumping)', () => {
  assert.equal(selectMascotState({ goalReached: true, celebrating: true, now: noon }), 'celebrating');
  assert.equal(selectMascotState({ goalReached: true, now: noon }), 'proud');
});

check('thirsty after a long gap, sleepy late at night, sad only when a period is missed', () => {
  assert.equal(selectMascotState({ goalReached: false, lastEntryAt: noon - 4 * 3600_000, now: noon }), 'thirsty');
  assert.equal(selectMascotState({ goalReached: false, lastEntryAt: noon - 600_000, now: noon }), 'idle');
  assert.equal(selectMascotState({ goalReached: false, hour: 23, lastEntryAt: noon, now: noon }), 'sleepy');
  assert.equal(selectMascotState({ goalReached: false, goalPeriodMissed: true, now: noon }), 'sad');
});

check('milestones fire once, at the highest mark crossed', () => {
  assert.equal(crossedMilestone(0.1, 0.3), 0.25);
  assert.equal(crossedMilestone(0.3, 0.45), null);
  assert.equal(crossedMilestone(0.2, 0.8), 0.75, 'a big drink reports the top mark only');
  assert.equal(crossedMilestone(0.8, 0.9), null);
});

check('every tap reaction has something to say, and wording rotates', () => {
  for (const reaction of ['giggle', 'wink', 'surprised', 'love'] as const) {
    assert.ok(tapLine(reaction, 1).length > 0, reaction);
  }
  assert.notEqual(tapLine('giggle', 1), tapLine('giggle', 5), 'second giggle says something new');
});

check('the mascot always has something to say', () => {
  const states = ['idle', 'happy', 'drink', 'thinking', 'thirsty', 'excited', 'celebrating', 'proud', 'sleepy', 'sad'] as const;
  for (const state of states) {
    for (const seed of [0, 1, 7]) {
      const line = mascotLine({ state, progress: 0.5, remainingLabel: '1 L', entryCount: 2, hour: 9, seed });
      assert.ok(line.length > 0, state);
    }
  }
});

console.log('\nCalendar grid (06.12)');

check('September 2026 starts on a Tuesday and fills whole weeks', () => {
  const grid = buildMonthGrid('2026-09');
  assert.equal(grid[0][0], null, 'Monday 31 Aug is outside the month');
  assert.equal(grid[0][1], '2026-09-01');
  assert.ok(grid.every((w) => w.length === 7));
  assert.equal(grid.flat().filter(Boolean).length, 30);
});

console.log(`\n${passed} checks passed.`);
