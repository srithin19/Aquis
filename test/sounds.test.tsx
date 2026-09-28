/**
 * Sound effects: the right cue at the right moment, silence when switched
 * off, and the notification sound following the same switch.
 */

import { act, fireEvent } from '@testing-library/react-native';
import * as Audio from 'expo-audio';
import React from 'react';

import * as sound from '@/services/sound';

import { freshStart, query, renderScreen, scheduled, settle } from './helpers';

/* eslint-disable @typescript-eslint/no-require-imports */
const Home = require('../app/(tabs)/index').default;
const Profile = require('../app/(tabs)/profile').default;
const { MomentSheet } = require('../src/components/MomentSheet');
/* eslint-enable @typescript-eslint/no-require-imports */

type Rendered = Awaited<ReturnType<typeof renderScreen>>;
const cues = jest.spyOn(sound, 'play');
const audible = () => (Audio as unknown as { __played: number[] }).__played;

beforeEach(async () => {
  await freshStart();
  cues.mockClear();
  audible().length = 0;
});

async function onboarded(r: Rendered, dailyGoalMl = 2000) {
  await act(async () => {
    await r.state().signIn({ provider: 'email', email: 'tester@example.com' });
  });
  await act(async () => {
    await r.state().updateSettings({ notificationsEnabled: true, onboardingCompleted: true });
    await r.state().startGoal({ dailyGoalMl, durationDays: 7 });
  });
  await settle();
}

const names = () => cues.mock.calls.map((c) => c[0]);

test('a drink goes "drop"; 25% adds a chime; the goal plays the celebration', async () => {
  const r = await renderScreen(<Home />);
  await onboarded(r, 1000);
  await fireEvent.press(r.screen.getByLabelText('Log 250 millilitres'));
  await settle();
  await new Promise((resolve) => setTimeout(resolve, 300)); // the chime waits for the drop
  expect(names()).toEqual(['drop', 'chime']);
  expect(audible().length).toBe(2);

  cues.mockClear();
  await fireEvent.press(r.screen.getByLabelText('Log 500 millilitres'));
  await settle();
  await fireEvent.press(r.screen.getByLabelText('Log 250 millilitres'));
  await settle();
  expect(names()).toContain('celebrate');
  expect(names().filter((n) => n === 'drop').length).toBe(1); // the goal log celebrates instead
});

test('tapping the mascot pops; removing a drink plays the undo blip', async () => {
  const r = await renderScreen(<Home />);
  await onboarded(r);
  await fireEvent.press(r.screen.getByLabelText(/Your water droplet/));
  expect(names()).toContain('pop');
  await act(async () => {
    await r.state().logWater(150, 'quick_add');
  });
  await settle();
  await fireEvent.press(r.screen.getAllByLabelText(/^Subtract 150 millilitres/)[0]);
  expect(names()).toContain('undo');
});

test('a badge sheet swishes in and twinkles', async () => {
  const r = await renderScreen(<MomentSheet />);
  await onboarded(r);
  await act(async () => {
    await r.state().logWater(250, 'quick_add');
  });
  await settle();
  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(names()).toEqual(expect.arrayContaining(['swish', 'twinkle']));
});

test('Sounds off: nothing is audible, and reminders turn silent', async () => {
  const r = await renderScreen(<Profile />);
  await onboarded(r);
  expect(scheduled()[0].content).toMatchObject({ sound: 'aquis_drop.wav' });
  expect((scheduled()[0].trigger as { channelId?: string }).channelId).toBe('hydration-sound');

  await fireEvent(r.screen.getByLabelText('Sounds'), 'valueChange', false);
  await settle();
  expect(query('SELECT sounds_enabled AS v FROM app_settings')[0].v).toBe(0);
  expect(scheduled()[0].content).toMatchObject({ sound: false });
  expect((scheduled()[0].trigger as { channelId?: string }).channelId).toBe('hydration-quiet');

  audible().length = 0;
  await act(async () => {
    await r.state().logWater(250, 'quick_add');
  });
  sound.play('drop');
  expect(audible()).toHaveLength(0);

  // Switching back on plays a preview.
  await fireEvent(r.screen.getByLabelText('Sounds'), 'valueChange', true);
  await settle();
  expect(audible().length).toBeGreaterThan(0);
});
