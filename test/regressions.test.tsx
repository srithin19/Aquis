/**
 * One test per bug found in the button audit, so none of them can come back.
 */

import { act, fireEvent } from '@testing-library/react-native';
import React from 'react';

import {
  freshStart,
  nav,
  query,
  renderScreen,
  routeParams,
  scheduled,
  settle,
  waitPastDoubleTap,
} from './helpers';

/* eslint-disable @typescript-eslint/no-require-imports */
const SignIn = require('../app/(onboarding)/sign-in').default;
const GoalSetup = require('../app/(onboarding)/goal').default;
const Duration = require('../app/(onboarding)/duration').default;
const Confirm = require('../app/(onboarding)/confirm').default;
const Home = require('../app/(tabs)/index').default;
const Profile = require('../app/(tabs)/profile').default;
const CustomAmount = require('../app/custom-amount').default;
const DayDetail = require('../app/day/[date]').default;
/* eslint-enable @typescript-eslint/no-require-imports */

type Rendered = Awaited<ReturnType<typeof renderScreen>>;

beforeEach(async () => {
  await freshStart();
});

async function onboarded(r: Rendered, goal = { dailyGoalMl: 2000, durationDays: 7 }, notifications = true) {
  await act(async () => {
    await r.state().signIn({ provider: 'email', email: 'tester@example.com' });
  });
  await act(async () => {
    await r.state().updateSettings({ notificationsEnabled: notifications, onboardingCompleted: true });
    await r.state().startGoal(goal);
  });
  await settle();
}

test('#1 signing out and back in returns to Home and keeps the running goal', async () => {
  const r = await renderScreen(<SignIn />);
  await onboarded(r);
  const goalId = r.state().activeGoal!.id;
  await act(async () => {
    await r.state().signOut();
  });
  await fireEvent.press(r.screen.getByText('Continue with email'));
  await fireEvent.changeText(r.screen.getByLabelText('Email address'), 'tester@example.com');
  waitPastDoubleTap();
  await fireEvent.press(r.screen.getByText('Continue'));
  await settle();
  expect(nav.dismissTo).toHaveBeenCalledWith('/(tabs)');
  expect(nav.replace).not.toHaveBeenCalledWith('/(onboarding)/goal');
  expect(r.state().activeGoal?.id).toBe(goalId);
  expect(scheduled().length).toBeGreaterThan(0); // reminders came back
});

test('#2 a new goal from inside the app keeps reminders off if they were off', async () => {
  // Goal setup and confirmation share one app (one onboarding draft), as on a phone.
  let go: (step: 'goal' | 'confirm') => void = () => {};
  function Flow() {
    const [step, setStep] = React.useState<'goal' | 'confirm'>('goal');
    go = setStep;
    return step === 'goal' ? <GoalSetup /> : <Confirm />;
  }
  const r = await renderScreen(<Flow />);
  await onboarded(r, { dailyGoalMl: 2000, durationDays: 7 }, false);
  // Re-enter goal setup the way Profile → "Start a new goal" would.
  await act(async () => go('confirm'));
  await act(async () => go('goal'));
  await settle();
  await act(async () => go('confirm'));
  await fireEvent.press(r.screen.getByText('Start my goal'));
  await settle();
  expect(query('SELECT notifications_enabled AS v FROM app_settings')[0].v).toBe(0);
  expect(scheduled()).toHaveLength(0);
});

test('#2b a new goal from inside the app skips the reminder and mascot intro screens', async () => {
  const r = await renderScreen(<Duration />);
  await onboarded(r);
  await fireEvent.press(r.screen.getByText('Continue'));
  expect(nav.push).toHaveBeenCalledWith('/(onboarding)/confirm');
});

test('#3 finishing a new goal returns to the existing tabs instead of stacking new ones', async () => {
  const r = await renderScreen(<Confirm />);
  await onboarded(r);
  expect(r.screen.getByText(/This replaces your current goal/)).toBeTruthy();
  await fireEvent.press(r.screen.getByText('Start my goal'));
  await settle();
  expect(nav.dismissTo).toHaveBeenCalledWith('/(tabs)');
  expect(nav.replace).not.toHaveBeenCalledWith('/(tabs)');
  expect(query("SELECT COUNT(*) AS n FROM goal WHERE status='active'")[0].n).toBe(1);
});

test('#4 the goal summary is pushed once, however often the app refreshes', async () => {
  const r = await renderScreen(<Home />);
  await onboarded(r, { dailyGoalMl: 2000, durationDays: 1 });
  query("UPDATE goal SET start_date = '2000-01-01', end_date = '2000-01-01'");
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await r.state().refresh();
    });
    await settle();
  }
  expect(nav.push.mock.calls.filter((c) => c[0] === '/goal-summary')).toHaveLength(1);
});

test('#5 no reminders are planned past the goal period’s last day', async () => {
  const r = await renderScreen(<Home />);
  await onboarded(r, { dailyGoalMl: 2000, durationDays: 1 });
  const today = r.state().today;
  expect(scheduled().length).toBeGreaterThanOrEqual(0);
  for (const n of scheduled()) {
    const d = n.trigger.date as Date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(key <= today).toBe(true);
  }
});

test('#6 double-tapping Add on Custom amount logs the drink once', async () => {
  const r = await renderScreen(<CustomAmount />);
  await onboarded(r);
  await fireEvent.changeText(r.screen.getByLabelText('Amount in millilitres'), '330');
  const add = r.screen.getByText('Add 330 ml');
  // Button, then the keyboard's submit straight after — the ref guard lets only one through.
  await fireEvent.press(add);
  await fireEvent(r.screen.getByLabelText('Amount in millilitres'), 'submitEditing');
  await settle();
  expect(query('SELECT COUNT(*) AS n FROM water_entry')[0].n).toBe(1);
});

test('#8 quick taps on the quiet-hours stepper each count', async () => {
  const r = await renderScreen(<Profile />);
  await onboarded(r);
  const later = r.screen.getByLabelText('From later');
  await fireEvent.press(later);
  await fireEvent.press(later);
  await settle();
  expect(r.state().settings.quietStart).toBe('23:00');
});

test('#9 Continue applies a typed custom goal and custom length', async () => {
  const g = await renderScreen(<GoalSetup />);
  await fireEvent.press(g.screen.getByText('Set a custom amount'));
  await fireEvent.changeText(g.screen.getByLabelText('Custom daily target in millilitres'), '3500');
  await fireEvent.press(g.screen.getByText('Continue'));
  expect(g.screen.getAllByText('3.5 L').length).toBeGreaterThan(0);

  // Invalid typed value blocks Continue with a reason.
  await fireEvent.press(g.screen.getByText('Custom: 3.5 L'));
  await fireEvent.changeText(g.screen.getByLabelText('Custom daily target in millilitres'), '50');
  waitPastDoubleTap();
  nav.push.mockClear();
  await fireEvent.press(g.screen.getByText('Continue'));
  expect(nav.push).not.toHaveBeenCalled();
  expect(g.screen.getByText('Daily targets start at 500 ml.')).toBeTruthy();
});

test('#10 the goal-complete card is honest about post-goal reminders', async () => {
  const r = await renderScreen(<Home />);
  await onboarded(r, { dailyGoalMl: 500, durationDays: 7 });
  await act(async () => {
    await r.state().updateSettings({ postGoalRemindersEnabled: true });
    await r.state().logWater(500, 'quick_add');
  });
  await settle();
  expect(r.screen.getByText(/Post-goal reminders are on/)).toBeTruthy();
});

test('#19 with no goal running, logging is disabled rather than counted against 0', async () => {
  const r = await renderScreen(<Home />);
  await act(async () => {
    await r.state().signIn({ provider: 'email', email: 'tester@example.com' });
  });
  await settle();
  expect(r.screen.getByText('No active goal')).toBeTruthy();
  await fireEvent.press(r.screen.getByLabelText('Log 250 millilitres'));
  await settle();
  expect(query('SELECT COUNT(*) AS n FROM water_entry')[0].n).toBe(0);
});

test('#29 a bad date opens "Day not found", and Close still works without history', async () => {
  routeParams.date = 'not-a-date';
  nav.canGoBack.mockReturnValueOnce(false);
  const r = await renderScreen(<DayDetail />);
  expect(r.screen.getByText('Day not found')).toBeTruthy();
  await fireEvent.press(r.screen.getByLabelText('Close'));
  expect(nav.replace).toHaveBeenCalledWith('/(tabs)/history');
});

test('emails are stored lower-case', async () => {
  const r = await renderScreen(<SignIn />);
  await fireEvent.press(r.screen.getByText('Continue with email'));
  await fireEvent.changeText(r.screen.getByLabelText('Email address'), 'Sri@Example.COM');
  waitPastDoubleTap();
  await fireEvent.press(r.screen.getByText('Continue'));
  await settle();
  expect(r.state().profile?.email).toBe('sri@example.com');
});
