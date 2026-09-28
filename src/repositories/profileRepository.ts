import { getDatabase } from '@/db/client';
import type { AuthProvider, UserProfile } from '@/domain/types';
import { createId } from '@/utils/id';

interface ProfileRow {
  id: string;
  display_name: string | null;
  email: string | null;
  provider: string;
  created_at: number;
  provider_ref: string | null;
  photo_url: string | null;
}

function toProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    provider: row.provider as AuthProvider,
    createdAt: row.created_at,
    providerRef: row.provider_ref,
    photoUrl: row.photo_url,
  };
}

export async function getProfile(): Promise<UserProfile | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ProfileRow>(
    'SELECT * FROM user_profile ORDER BY created_at ASC LIMIT 1;',
  );
  return row ? toProfile(row) : null;
}

/**
 * One person per phone: signing in stores this profile in place of any other.
 * Hydration history is not keyed to the profile, so it stays.
 */
export async function replaceProfile(input: {
  provider: AuthProvider;
  providerRef: string | null;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
}): Promise<UserProfile> {
  const db = await getDatabase();
  const profile: UserProfile = {
    id: createId('usr'),
    displayName: input.displayName,
    email: input.email,
    provider: input.provider,
    createdAt: Date.now(),
    providerRef: input.providerRef,
    photoUrl: input.photoUrl,
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM user_profile;');
    await db.runAsync(
      `INSERT INTO user_profile (id, display_name, email, provider, created_at, provider_ref, photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        profile.id,
        profile.displayName,
        profile.email,
        profile.provider,
        profile.createdAt,
        profile.providerRef,
        profile.photoUrl,
      ],
    );
  });
  return profile;
}

export async function clearProfile(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM user_profile;');
}
