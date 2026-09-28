/**
 * Google Sign-In — Product Bible 06.3 ("Continue with Google").
 *
 * Uses the native Google Sign-In SDK. That SDK has to be compiled into the
 * app, so it works in a development or store build but not in Expo Go; and it
 * needs the OAuth client IDs from Google Cloud in `.env`. `googleAvailability`
 * says which of those is missing, so the UI can explain it instead of
 * pretending to sign in.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export type GoogleAvailability = 'ready' | 'expo-go' | 'not-configured' | 'unsupported';

export interface GoogleUser {
  id: string;
  email: string;
  name: string | null;
  photo: string | null;
}

export type GoogleResult =
  | { status: 'success'; user: GoogleUser }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

function clientIds() {
  return {
    web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  };
}

export function googleAvailability(): GoogleAvailability {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'unsupported';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expo-go';
  const ids = clientIds();
  if (!ids.web || (Platform.OS === 'ios' && !ids.ios)) return 'not-configured';
  return 'ready';
}

let configured = false;

/** Loaded on demand: the native module does not exist in Expo Go. */
function google(): GoogleModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod: GoogleModule = require('@react-native-google-signin/google-signin');
  if (!configured) {
    const ids = clientIds();
    mod.GoogleSignin.configure({ webClientId: ids.web, iosClientId: ids.ios });
    configured = true;
  }
  return mod;
}

export async function signInWithGoogle(): Promise<GoogleResult> {
  const availability = googleAvailability();
  if (availability !== 'ready') {
    return { status: 'error', message: availabilityMessage(availability) };
  }
  try {
    const { GoogleSignin } = google();
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') return { status: 'cancelled' };
    const { user } = response.data;
    return {
      status: 'success',
      user: {
        id: user.id,
        email: user.email.toLowerCase(),
        name: user.name ?? user.givenName ?? null,
        photo: user.photo,
      },
    };
  } catch (error) {
    const { statusCodes } = google();
    const code = (error as { code?: string } | null)?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) return { status: 'cancelled' };
    if (code === statusCodes.IN_PROGRESS) return { status: 'error', message: 'Google sign-in is already open.' };
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { status: 'error', message: 'Google Play services are missing or out of date on this phone.' };
    }
    return { status: 'error', message: 'Google sign-in didn’t work. Check your connection and try again.' };
  }
}

/** Also forget the Google account, so the next sign-in shows the account picker. */
export async function signOutOfGoogle(): Promise<void> {
  if (googleAvailability() !== 'ready') return;
  try {
    await google().GoogleSignin.signOut();
  } catch {
    /* Already signed out of Google — nothing to undo. */
  }
}

export function availabilityMessage(availability: GoogleAvailability): string {
  switch (availability) {
    case 'expo-go':
      return 'Google sign-in needs the AQUIS app build — Expo Go can’t run it. You can continue with email for now.';
    case 'not-configured':
      return 'Google sign-in isn’t set up in this build yet (the Google client IDs are missing). Continue with email for now.';
    case 'unsupported':
      return 'Google sign-in is only available on iPhone and Android.';
    default:
      return '';
  }
}
