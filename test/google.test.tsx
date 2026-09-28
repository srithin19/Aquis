/**
 * Google sign-in: real SDK path (mocked at the native edge), honest fallbacks
 * where Google cannot run, and clean sign-out.
 */

import { act, fireEvent } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import React from 'react';

import { alerts, chooseAlert, freshStart, nav, query, renderScreen, settle } from './helpers';

/* eslint-disable @typescript-eslint/no-require-imports */
const SignIn = require('../app/(onboarding)/sign-in').default;
const Profile = require('../app/(tabs)/profile').default;
/* eslint-enable @typescript-eslint/no-require-imports */

const signIn = GoogleSignin.signIn as jest.Mock;
const env = process.env as Record<string, string | undefined>;

beforeEach(async () => {
  await freshStart();
  env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-123.apps.googleusercontent.com';
  env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-123.apps.googleusercontent.com';
  (Constants as unknown as { executionEnvironment: string }).executionEnvironment = 'bare';
});

afterEach(() => {
  delete env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  delete env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
});

test('signs in with the Google account and stores its name, email, id and photo', async () => {
  const r = await renderScreen(<SignIn />);
  await fireEvent.press(r.screen.getByLabelText('Continue with Google'));
  await settle();
  expect(GoogleSignin.configure).toHaveBeenCalledWith({
    webClientId: 'web-123.apps.googleusercontent.com',
    iosClientId: 'ios-123.apps.googleusercontent.com',
  });
  expect(r.state().profile).toMatchObject({
    provider: 'google',
    providerRef: 'google-123',
    email: 'sri.c@gmail.com',
    displayName: 'Sri C',
    photoUrl: 'https://example.com/sri.png',
  });
  expect(query('SELECT COUNT(*) AS n FROM user_profile')[0].n).toBe(1);
  expect(nav.replace).toHaveBeenCalledWith('/(onboarding)/goal');
});

test('closing the Google sheet leaves you on sign-in, with no profile and no error', async () => {
  signIn.mockResolvedValueOnce({ type: 'cancelled', data: null });
  const r = await renderScreen(<SignIn />);
  await fireEvent.press(r.screen.getByLabelText('Continue with Google'));
  await settle();
  expect(r.state().profile).toBeNull();
  expect(nav.replace).not.toHaveBeenCalled();
  expect(r.screen.queryByText(/didn’t work/)).toBeNull();
});

test('a Google error is explained on screen', async () => {
  signIn.mockRejectedValueOnce({ code: 'PLAY_SERVICES_NOT_AVAILABLE' });
  const r = await renderScreen(<SignIn />);
  await fireEvent.press(r.screen.getByLabelText('Continue with Google'));
  await settle();
  expect(r.screen.getByText(/Google Play services are missing/)).toBeTruthy();
  expect(r.state().profile).toBeNull();
});

test('in Expo Go, Google explains it needs the app build and offers email', async () => {
  (Constants as unknown as { executionEnvironment: string }).executionEnvironment = 'storeClient';
  chooseAlert('OK');
  const r = await renderScreen(<SignIn />);
  await fireEvent.press(r.screen.getByLabelText('Continue with Google'));
  expect(alerts()[0].message).toMatch(/needs the AQUIS app build/);
  expect(signIn).not.toHaveBeenCalled();
  expect(r.state().profile).toBeNull();
});

test('signing out also signs out of Google; Profile shows the Google account', async () => {
  const r = await renderScreen(<Profile />);
  await act(async () => {
    await r.state().signIn({ provider: 'google' });
  });
  await settle();
  expect(r.screen.getByText('Signed in with Google')).toBeTruthy();
  expect(r.screen.getByLabelText('Your Google photo')).toBeTruthy();
  await act(async () => {
    await r.state().signOut();
  });
  expect(GoogleSignin.signOut).toHaveBeenCalled();
  expect(r.state().profile).toBeNull();
});
