/**
 * Authentication — Product Bible 06.3.
 *
 * The screens talk to this module, not to a vendor SDK.
 *
 *  - Google: the real Google Sign-In SDK (see googleAuth.ts). The profile
 *    stores the Google account's id, name, email and photo.
 *  - Email: records the address as a local profile. There is no backend in V1
 *    (Product Bible 15), so nothing is sent and the address is not verified.
 *
 * Hydration data is not tied to the profile id, so switching accounts on one
 * phone keeps the history on that phone (17 — local-first).
 */

import type { AuthProvider as ProviderKind, UserProfile } from '@/domain/types';
import { replaceProfile, getProfile } from '@/repositories/profileRepository';

import { availabilityMessage, googleAvailability, signInWithGoogle, signOutOfGoogle } from './googleAuth';

export interface SignInRequest {
  provider: Exclude<ProviderKind, 'local'>;
  email?: string;
  displayName?: string;
}

export type SignInOutcome =
  | { status: 'signed-in'; profile: UserProfile }
  | { status: 'cancelled' }
  | { status: 'unavailable' | 'error'; message: string };

export interface AuthProviderAdapter {
  signIn(request: SignInRequest): Promise<SignInOutcome>;
  signOut(): Promise<void>;
  restore(): Promise<UserProfile | null>;
}

const adapter: AuthProviderAdapter = {
  async signIn(request) {
    if (request.provider === 'google') {
      const availability = googleAvailability();
      if (availability !== 'ready') {
        return { status: 'unavailable', message: availabilityMessage(availability) };
      }
      const result = await signInWithGoogle();
      if (result.status === 'cancelled') return result;
      if (result.status === 'error') return result;
      const profile = await replaceProfile({
        provider: 'google',
        providerRef: result.user.id,
        email: result.user.email,
        displayName: result.user.name ?? deriveName(result.user.email),
        photoUrl: result.user.photo,
      });
      return { status: 'signed-in', profile };
    }

    const email = request.email?.trim().toLowerCase() ?? null;
    const existing = await getProfile();
    // Same person tapping through again: keep their profile as it is.
    if (existing && existing.provider === 'email' && existing.email === email) {
      return { status: 'signed-in', profile: existing };
    }
    const profile = await replaceProfile({
      provider: 'email',
      providerRef: null,
      email,
      displayName: request.displayName ?? deriveName(email),
      photoUrl: null,
    });
    return { status: 'signed-in', profile };
  },

  async signOut() {
    await signOutOfGoogle();
  },

  async restore() {
    return getProfile();
  },
};

function deriveName(email?: string | null): string | null {
  if (!email) return null;
  const handle = email.split('@')[0]?.split(/[._+-]/)[0]?.trim();
  if (!handle) return null;
  return handle.charAt(0).toUpperCase() + handle.slice(1);
}

export function getAuthProvider(): AuthProviderAdapter {
  return adapter;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
