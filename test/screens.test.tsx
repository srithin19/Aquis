/**
 * Every screen, every button: rendered inside the real providers on a real
 * (sql.js) database, pressed like a user would, and checked for what it
 * should do — navigation, database writes, reminders, and what shows on screen.
 */

import { act, fireEvent, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import React from 'react';

import {
  alerts,
  chooseAlert,
  freshStart,
  nav,
  query,
  renderScreen,
  routeParams,
  scheduled,
  setPermission,
  settle,
  waitPastDoubleTap,
} from './helpers';

/* eslint-disable @typescript-eslint/no-require-imports */
const Splash = require('../app/index').default;
const Welcome = require('../app/(onboarding)/welcome').default;
const SignIn = require('../app/(onboarding)/sign-in').default;
const GoalSetup = require('../app/(onboarding)/goal').default;
const Duration = require('../app/(onboarding)/duration').default;
const NotificationSetup = require('../app/(onboarding)/notifications').default;
const MascotIntro = require('../app/(onboarding)/mascot').default;
const Confirm = require('../app/(onboarding)/confirm').default;
const Home = require('../app/(tabs)/index').default;
const History = require('../app/(tabs)/history').default;
const Achievements = require('../app/(tabs)/achievements').default;
const Profile = require('../app/(tabs)/profile').default;
const { GlassTabBar } = require('../app/(tabs)/_layout');
const CustomAmount = require('../app/custom-amount').default;
const DayDetail = require('../app/day/[date]').default;
const GoalSummary = require('../app/goal-summary').default;
const { MomentSheet } = require('../src/components/MomentSheet');
/* eslint-enable @typescript-eslint/no-require-imports */

type Rendered = Awaited<ReturnType<typeof renderScreen>>;

beforeEach(async () => {
  await freshStart();
});

/** Sign in + a 2 L / 7 day goal, as onboarding would leave it. */
async function onboarded(r: Rendered, goal = { dailyGoalMl: 2000, durationDays: 7 }) {
  await act(async () => {
    await r.state().signIn({ provider: 'google' });
  });
  await act(async () => {
    await r.state().updateSettings({ notificationsEnabled: true, onboardingCompleted: true });
    await r.state().startGoal(goal);
  });
  await settle();
}

const mascotMood = (r: Rendered) =>
  String(r.screen.getByTestId('mascot').props.accessibilityValue.text).split('|')[0];

/* ------------------------------------------------------------ onboarding */

describe('Splash', () => {
  test('first launch routes to Welcome', async () => {
    await renderScreen(<Splash />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/(onboarding)/welcome'), { timeout: 2500 });
  });

  test('a signed-in user with a goal goes straight to Home', async () => {
    const r = await renderScreen(<Splash />);
    await onboarded(r);
    await waitFor(() => expect(nav.replace).toHaveBeenCalled(), { timeout: 2500 });
  });
});

describe('Welcome', () => {
  test('Get started and Sign in both open authentication', async () => {
    const { screen } = await renderScreen(<Welcome />);
    await fireEvent.press(screen.getByText('Get started'));
    await fireEvent.press(screen.getByText('Already have an account? Sign in'));
    expect(nav.push).toHaveBeenCalledTimes(2);
    expect(nav.push).toHaveBeenCalledWith('/(onboarding)/sign-in');
  });
});

describe('Sign in', () => {
  test('Continue with Google creates a profile and moves to goal setup', async () => {
    const r = await renderScreen(<SignIn />);
    await fireEvent.press(r.screen.getByText('Continue with Google'));
    await settle();
    expect(r.state().profile?.provider).toBe('google');
    expect(nav.replace).toHaveBeenCalledWith('/(onboarding)/goal');
  });

  test('email: rejects a bad address, accepts a good one, Back returns', async () => {
    const r = await renderScreen(<SignIn />);
    await fireEvent.press(r.screen.getByText('Continue with email'));
    const input = r.screen.getByLabelText('Email address');

    await fireEvent.changeText(input, 'not-an-email');
    waitPastDoubleTap(); // a person takes longer than 600 ms to type an address
    await fireEvent.press(r.screen.getByText('Continue'));
    expect(r.screen.getByText('That email address looks incomplete.')).toBeTruthy();
    expect(r.state().profile).toBeNull();

    await fireEvent.changeText(input, 'Maya@Example.com');
    waitPastDoubleTap();
    await fireEvent.press(r.screen.getByText('Continue'));
    await settle();
    expect(r.state().profile).toMatchObject({ email: 'maya@example.com', displayName: 'Maya' });

    await fireEvent.press(r.screen.getByText('Back'));
    expect(r.screen.getByText('Continue with Google')).toBeTruthy();
  });
});

describe('Goal setup', () => {
  test('presets select, custom validates, Continue goes to duration', async () => {
    const r = await renderScreen(<GoalSetup />);
    await fireEvent.press(r.screen.getByText('2.5 L'));
    expect(r.screen.getAllByText('2.5 L').length).toBeGreaterThanOrEqual(2); // option + big preview

    await fireEvent.press(r.screen.getByText('Set a custom amount'));
    const input = r.screen.getByLabelText('Custom daily target in millilitres');
    await fireEvent.changeText(input, '100');
    await fireEvent.press(r.screen.getByText('Use this target'));
    expect(r.screen.getByText('Daily targets start at 500 ml.')).toBeTruthy();

    await fireEvent.changeText(input, '2200');
    waitPastDoubleTap();
    await fireEvent.press(r.screen.getByText('Use this target'));
    expect(r.screen.getByText('Custom: 2.2 L')).toBeTruthy();

    await fireEvent.press(r.screen.getByText('Continue'));
    expect(nav.push).toHaveBeenCalledWith('/(onboarding)/duration');
  });
});

describe('Goal duration', () => {
  test('presets update the preview, custom validates, Continue moves on', async () => {
    const r = await renderScreen(<Duration />);
    await fireEvent.press(r.screen.getByText('14 days'));
    expect(r.screen.getByText('Day 1 of 14')).toBeTruthy();

    await fireEvent.press(r.screen.getByText('Set a custom length'));
    const input = r.screen.getByLabelText('Custom goal length in days');
    await fireEvent.changeText(input, '0');
    await fireEvent.press(r.screen.getByText('Use this length'));
    expect(r.screen.getByText('Goal periods run from 1 to 365 days.')).toBeTruthy();
    await fireEvent.changeText(input, '10');
    waitPastDoubleTap();
    await fireEvent.press(r.screen.getByText('Use this length'));
    expect(r.screen.getByText('Day 1 of 10')).toBeTruthy();

    await fireEvent.press(r.screen.getByText('Continue'));
    expect(nav.push).toHaveBeenCalledWith('/(onboarding)/notifications');
  });
});

describe('Notification setup', () => {
  test('with reminders on, Continue asks for permission after the explanation', async () => {
    setPermission(false, true);
    const r = await renderScreen(<NotificationSetup />);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    await fireEvent.press(r.screen.getByText('Continue'));
    await settle();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(nav.push).toHaveBeenCalledWith('/(onboarding)/mascot');
  });

  test('with reminders switched off, no permission prompt at all', async () => {
    const r = await renderScreen(<NotificationSetup />);
    await fireEvent(r.screen.getByLabelText('Enable hydration reminders'), 'valueChange', false);
    await fireEvent.press(r.screen.getByText('Continue'));
    await settle();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(nav.push).toHaveBeenCalledWith('/(onboarding)/mascot');
  });
});

describe('Mascot introduction', () => {
  test('tapping the mascot makes it react; Continue goes to confirmation', async () => {
    const r = await renderScreen(<MascotIntro />);
    await fireEvent.press(r.screen.getByLabelText('Say hi to your droplet'));
    expect(mascotMood(r)).toBe('giggle');
    await fireEvent.press(r.screen.getByText('Continue'));
    expect(nav.push).toHaveBeenCalledWith('/(onboarding)/confirm');
  });
});

describe('Goal confirmation', () => {
  test('Start my goal saves the goal and the preference, then opens Home', async () => {
    const r = await renderScreen(<Confirm />);
    await act(async () => {
      await r.state().signIn({ provider: 'google' });
    });
    await fireEvent.press(r.screen.getByText('Start my goal'));
    await settle();
    expect(query("SELECT daily_goal_ml, duration_days, status FROM goal")[0]).toEqual({
      daily_goal_ml: 2000,
      duration_days: 7,
      status: 'active',
    });
    expect(query('SELECT onboarding_completed, notifications_enabled FROM app_settings')[0]).toEqual({
      onboarding_completed: 1,
      notifications_enabled: 1,
    });
    expect(nav.dismissTo).toHaveBeenCalledWith('/(tabs)');
    expect(scheduled().length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ Home */

describe('Home', () => {
  test('every quick-add tile logs its amount; the minus removes that drink', async () => {
    const r = await renderScreen(<Home />);
    await onboarded(r);
    for (const amount of [150, 250, 500]) {
      await fireEvent.press(r.screen.getByLabelText(`Log ${amount} millilitres`));
      await settle();
    }
    expect(r.state().consumedMl).toBe(900);
    expect(r.state().entries).toHaveLength(3);

    const minus = r.screen.getAllByLabelText(/^Subtract 250 millilitres/)[0];
    await fireEvent.press(minus);
    await settle();
    expect(r.state().consumedMl).toBe(650);
    expect(r.state().entries.map((e) => e.amountMl)).toEqual([150, 500]);
  });

  test('a drink makes the mascot gulp; tapping it plays a reaction and it speaks', async () => {
    const r = await renderScreen(<Home />);
    await onboarded(r);
    await fireEvent.press(r.screen.getByLabelText('Log 250 millilitres'));
    await settle();
    expect(mascotMood(r)).toBe('drink');

    await fireEvent.press(r.screen.getByLabelText(/Your water droplet/));
    expect(mascotMood(r)).toBe('giggle');
    expect(r.screen.getByText(/tickl|Again/)).toBeTruthy();
  });

  test('Custom amount opens its sheet', async () => {
    const r = await renderScreen(<Home />);
    await onboarded(r);
    await fireEvent.press(r.screen.getByText('Custom amount'));
    expect(nav.push).toHaveBeenCalledWith('/custom-amount');
  });

  test('reaching the goal throws the party and shows the complete card', async () => {
    const r = await renderScreen(<Home />);
    await onboarded(r, { dailyGoalMl: 1000, durationDays: 7 });
    await fireEvent.press(r.screen.getByLabelText('Log 500 millilitres'));
    await settle();
    await fireEvent.press(r.screen.getByLabelText('Log 500 millilitres'));
    await settle();
    expect(r.state().goalReached).toBe(true);
    expect(r.screen.getByText('Goal complete for today')).toBeTruthy();
    expect(r.screen.getByText('GOAL COMPLETE · 1.0 L')).toBeTruthy();
    expect(mascotMood(r)).toBe('celebrating');
  });

  test('shows the next reminder time, and says so when reminders are off', async () => {
    const r = await renderScreen(<Home />);
    await onboarded(r);
    expect(r.screen.getByText(/Next nudge around/)).toBeTruthy();
    await act(async () => {
      await r.state().updateSettings({ notificationsEnabled: false });
    });
    expect(r.screen.getByText('Reminders are off')).toBeTruthy();
  });
});

describe('Custom amount', () => {
  test('chips fill the field, typing works, Add logs the exact amount and closes', async () => {
    const r = await renderScreen(<CustomAmount />);
    await onboarded(r);
    await fireEvent.press(r.screen.getByText('600 ml'));
    expect(r.screen.getByText('Add 600 ml')).toBeTruthy();

    await fireEvent.changeText(r.screen.getByLabelText('Amount in millilitres'), '330');
    await fireEvent.press(r.screen.getByText('Add 330 ml'));
    await settle();
    expect(r.state().entries.map((e) => [e.amountMl, e.source])).toEqual([[330, 'custom']]);
    expect(nav.back).toHaveBeenCalled();
  });

  test('zero cannot be added; Cancel and the close button go back', async () => {
    const r = await renderScreen(<CustomAmount />);
    await onboarded(r);
    await fireEvent.changeText(r.screen.getByLabelText('Amount in millilitres'), '0');
    await fireEvent.press(r.screen.getByText('Add to today'));
    await settle();
    expect(r.state().entries).toHaveLength(0);
    await fireEvent.press(r.screen.getByText('Cancel'));
    await fireEvent.press(r.screen.getAllByLabelText('Cancel')[0]);
    expect(nav.back).toHaveBeenCalledTimes(2);
  });
});

/* ------------------------------------------------------- History / badges */

describe('History', () => {
  test('today’s droplet opens day detail; you cannot page into the future', async () => {
    const r = await renderScreen(<History />);
    await onboarded(r);
    await act(async () => {
      await r.state().logWater(600, 'quick_add');
    });
    await settle();
    const today = r.state().today;
    await fireEvent.press(r.screen.getByLabelText(`${today}, 30%`));
    expect(nav.push).toHaveBeenCalledWith({ pathname: '/day/[date]', params: { date: today } });

    const next = r.screen.getByLabelText('Next month');
    expect(next.props.accessibilityState?.disabled ?? next.props.disabled).toBeTruthy();
    await fireEvent.press(r.screen.getByLabelText('Previous month'));
    expect(r.screen.getByLabelText('Next month')).toBeTruthy();
  });
});

describe('Day detail', () => {
  test('shows that day’s goal, total and timeline; Close goes back', async () => {
    const r = await renderScreen(<DayDetail />);
    await onboarded(r);
    await act(async () => {
      await r.state().logWater(250, 'quick_add');
      await r.state().logWater(750, 'custom');
    });
    routeParams.date = r.state().today;
    const d = await renderScreen(<DayDetail />);
    await settle();
    expect(d.screen.getByText('50%')).toBeTruthy();
    expect(d.screen.getByText('2.0 L a day')).toBeTruthy();
    expect(d.screen.getByText('750 ml')).toBeTruthy();
    await fireEvent.press(d.screen.getByLabelText('Close'));
    expect(nav.back).toHaveBeenCalled();
    r.screen.unmount();
  });
});

describe('Achievements', () => {
  test('a first drink unlocks First Sip and the count updates', async () => {
    const r = await renderScreen(<Achievements />);
    await onboarded(r);
    expect(r.screen.getByText('0 of 7 unlocked')).toBeTruthy();
    await act(async () => {
      await r.state().logWater(250, 'quick_add');
    });
    await settle();
    expect(r.screen.getByText('1 of 7 unlocked')).toBeTruthy();
    expect(r.screen.getByText('UNLOCKED')).toBeTruthy();
  });
});

describe('Badge sheet', () => {
  test('appears once after earning a badge; Keep going dismisses it', async () => {
    const r = await renderScreen(<MomentSheet />);
    await onboarded(r);
    await act(async () => {
      await r.state().logWater(250, 'quick_add');
    });
    await settle();
    expect(r.screen.getByText('First Sip')).toBeTruthy();
    await fireEvent.press(r.screen.getByText('Keep going'));
    expect(r.screen.queryByText('First Sip')).toBeNull();
  });
});

/* --------------------------------------------------------------- Profile */

describe('Profile', () => {
  test('every toggle saves', async () => {
    const r = await renderScreen(<Profile />);
    await onboarded(r);
    for (const [label, column] of [
      ['Remind me after my goal', 'post_goal_reminders_enabled'],
      ['Reduce motion', 'reduce_motion'],
      ['Haptics', 'haptics_enabled'],
    ] as const) {
      const before = query(`SELECT ${column} AS v FROM app_settings`)[0].v;
      await fireEvent(r.screen.getByLabelText(label), 'valueChange', !before);
      await settle();
      expect(query(`SELECT ${column} AS v FROM app_settings`)[0].v).toBe(before ? 0 : 1);
    }
    await fireEvent(r.screen.getByLabelText('Hydration reminders'), 'valueChange', false);
    await settle();
    expect(query('SELECT notifications_enabled AS v FROM app_settings')[0].v).toBe(0);
    expect(scheduled()).toHaveLength(0);
  });

  test('quiet-hour steppers move by 30 minutes and wrap past midnight', async () => {
    const r = await renderScreen(<Profile />);
    await onboarded(r);
    await fireEvent.press(r.screen.getByLabelText('From later'));
    await settle();
    expect(r.state().settings.quietStart).toBe('22:30');
    await fireEvent.press(r.screen.getByLabelText('Until earlier'));
    await settle();
    expect(r.state().settings.quietEnd).toBe('06:30');
    for (let i = 0; i < 4; i += 1) {
      await fireEvent.press(r.screen.getByLabelText('From later'));
      await settle();
    }
    expect(r.state().settings.quietStart).toBe('00:30');
  });

  test('quick-add sets change Home’s tiles, and Reset to default restores them', async () => {
    const r = await renderScreen(<Profile />);
    await onboarded(r);
    await fireEvent.press(r.screen.getByText('200 · 300 · 600 ml'));
    await settle();
    expect(r.state().settings.quickAddMl).toEqual([200, 300, 600]);
    await fireEvent.press(r.screen.getByText('Reset to default'));
    await settle();
    expect(r.state().settings.quickAddMl).toEqual([150, 250, 500]);
  });

  test('Send a test nudge schedules a real-looking reminder in 5 seconds', async () => {
    const r = await renderScreen(<Profile />);
    await onboarded(r);
    await act(async () => {
      await r.state().logWater(500, 'quick_add');
    });
    await settle();
    await fireEvent.press(r.screen.getByText('Send a test nudge'));
    await settle();
    const test = scheduled().find((n) => n.content.data.test);
    expect(test).toBeTruthy();
    expect(test!.trigger.seconds).toBe(5);
    expect(test!.content.body).toBe('500 ml of 2.0 L (25%) · 1.5 L to go');
    expect(r.screen.getByText(/Arriving in 5 s/)).toBeTruthy();
  });

  test('test nudge with notifications blocked explains how to fix it', async () => {
    const r = await renderScreen(<Profile />);
    await onboarded(r);
    setPermission(false, false);
    chooseAlert('Not now');
    await fireEvent.press(r.screen.getByText('Send a test nudge'));
    await settle();
    expect(alerts().map((a) => a.title)).toContain('Notifications are off for AQUIS');
  });

  test('Coming up lists the planned nudges', async () => {
    const r = await renderScreen(<Profile />);
    await onboarded(r);
    await act(async () => {
      await r.state().refresh();
    });
    await settle();
    expect(r.screen.getAllByText(/around/).length).toBeGreaterThan(0);
  });

  test('Start a new goal opens goal setup', async () => {
    const r = await renderScreen(<Profile />);
    await onboarded(r);
    await fireEvent.press(r.screen.getByText('Start a new goal'));
    expect(nav.push).toHaveBeenCalledWith('/(onboarding)/goal');
  });

  test('Sign out asks first, then signs out and returns to the start', async () => {
    const r = await renderScreen(<Profile />);
    await onboarded(r);
    chooseAlert('Cancel');
    await fireEvent.press(r.screen.getByText('Sign out'));
    await settle();
    expect(r.state().profile).not.toBeNull();

    chooseAlert('Sign out');
    waitPastDoubleTap();
    await fireEvent.press(r.screen.getByText('Sign out'));
    await settle();
    expect(r.state().profile).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith('/');
  });

  test('Reset local data asks first, then wipes everything', async () => {
    const r = await renderScreen(<Profile />);
    await onboarded(r);
    await act(async () => {
      await r.state().logWater(250, 'quick_add');
    });
    chooseAlert('Reset');
    await fireEvent.press(r.screen.getByText('Reset local data'));
    await settle();
    expect(query('SELECT COUNT(*) AS n FROM water_entry')[0].n).toBe(0);
    expect(query('SELECT COUNT(*) AS n FROM goal')[0].n).toBe(0);
    expect(r.state().profile).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith('/');
  });
});

/* ------------------------------------------------------------- tab bar */

describe('Tab bar', () => {
  test('each tab navigates; the current tab does nothing', async () => {
    const routes = ['index', 'history', 'achievements', 'profile'].map((name) => ({ key: name, name }));
    const navigation = { navigate: jest.fn(), emit: jest.fn(() => ({ defaultPrevented: false })) };
    const descriptors = Object.fromEntries(
      routes.map((route, i) => [route.key, { options: { title: ['Home', 'History', 'Achievements', 'Profile'][i] } }]),
    );
    const { screen } = await renderScreen(
      <GlassTabBar state={{ index: 0, routes }} descriptors={descriptors} navigation={navigation} />,
    );
    for (const label of ['History', 'Achievements', 'Profile']) {
      await fireEvent.press(screen.getByLabelText(label));
    }
    await fireEvent.press(screen.getByLabelText('Home'));
    expect(navigation.navigate.mock.calls.map((c) => c[0])).toEqual(['history', 'achievements', 'profile']);
  });
});

/* -------------------------------------------------------- goal summary */

describe('Goal summary', () => {
  test('after a period ends, Start a new goal acknowledges it and opens setup', async () => {
    const r = await renderScreen(<GoalSummary />);
    await onboarded(r, { dailyGoalMl: 2000, durationDays: 1 });
    // Pretend the goal ended yesterday.
    query("UPDATE goal SET start_date = '2000-01-01', end_date = '2000-01-01'");
    await act(async () => {
      await r.state().refresh();
    });
    await settle();
    expect(r.screen.getByText('GOAL PERIOD COMPLETE')).toBeTruthy();
    await fireEvent.press(r.screen.getByText('Start a new goal'));
    await settle();
    expect(query('SELECT summary_seen FROM goal')[0].summary_seen).toBe(1);
    expect(nav.replace).toHaveBeenCalledWith('/(onboarding)/goal');
  });
});
