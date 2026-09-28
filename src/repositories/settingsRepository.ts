import { getDatabase } from '@/db/client';
import { DEFAULT_QUICK_ADD_ML } from '@/domain/hydration';
import type { AppSettings } from '@/domain/types';

interface SettingsRow {
  notifications_enabled: number;
  quiet_start: string;
  quiet_end: string;
  reduce_motion: number;
  haptics_enabled: number;
  sounds_enabled: number;
  quick_add_ml: string;
  post_goal_reminders_enabled: number;
  onboarding_completed: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  quietStart: '22:00',
  quietEnd: '07:00',
  reduceMotion: false,
  hapticsEnabled: true,
  soundsEnabled: true,
  quickAddMl: [...DEFAULT_QUICK_ADD_ML],
  postGoalRemindersEnabled: false,
  onboardingCompleted: false,
};

function parseQuickAdd(raw: string): number[] {
  const values = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length > 0 ? values : [...DEFAULT_QUICK_ADD_ML];
}

function toSettings(row: SettingsRow): AppSettings {
  return {
    notificationsEnabled: row.notifications_enabled === 1,
    quietStart: row.quiet_start,
    quietEnd: row.quiet_end,
    reduceMotion: row.reduce_motion === 1,
    hapticsEnabled: row.haptics_enabled === 1,
    soundsEnabled: row.sounds_enabled !== 0,
    quickAddMl: parseQuickAdd(row.quick_add_ml),
    postGoalRemindersEnabled: row.post_goal_reminders_enabled === 1,
    onboardingCompleted: row.onboarding_completed === 1,
  };
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SettingsRow>('SELECT * FROM app_settings WHERE id = 1;');
  if (row) return toSettings(row);

  await db.runAsync('INSERT OR IGNORE INTO app_settings (id) VALUES (1);');
  const created = await db.getFirstAsync<SettingsRow>('SELECT * FROM app_settings WHERE id = 1;');
  return created ? toSettings(created) : DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const db = await getDatabase();
  await db.runAsync('INSERT OR IGNORE INTO app_settings (id) VALUES (1);');

  const assignments: string[] = [];
  const values: (string | number)[] = [];

  const set = (column: string, value: string | number) => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if (patch.notificationsEnabled !== undefined) set('notifications_enabled', patch.notificationsEnabled ? 1 : 0);
  if (patch.quietStart !== undefined) set('quiet_start', patch.quietStart);
  if (patch.quietEnd !== undefined) set('quiet_end', patch.quietEnd);
  if (patch.reduceMotion !== undefined) set('reduce_motion', patch.reduceMotion ? 1 : 0);
  if (patch.hapticsEnabled !== undefined) set('haptics_enabled', patch.hapticsEnabled ? 1 : 0);
  if (patch.soundsEnabled !== undefined) set('sounds_enabled', patch.soundsEnabled ? 1 : 0);
  if (patch.quickAddMl !== undefined) set('quick_add_ml', patch.quickAddMl.join(','));
  if (patch.postGoalRemindersEnabled !== undefined) {
    set('post_goal_reminders_enabled', patch.postGoalRemindersEnabled ? 1 : 0);
  }
  if (patch.onboardingCompleted !== undefined) set('onboarding_completed', patch.onboardingCompleted ? 1 : 0);

  if (assignments.length > 0) {
    await db.runAsync(`UPDATE app_settings SET ${assignments.join(', ')} WHERE id = 1;`, values);
  }
  return getSettings();
}
