/**
 * Notification adapter — Product Bible 10 / 15.
 *
 * "Keep notification scheduling behind an interface so it can later be
 * replaced or extended by a backend-assisted personalization service."
 *
 * The planner (`domain/notifications`) decides *when*; this module only talks
 * to expo-notifications. Every sync cancels everything AQUIS has pending and
 * schedules the fresh plan, so there is never a stale reminder or a backlog.
 * Local notifications only — no push token is ever requested (17).
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { planReminders, reminderBody, titleFor, type ReminderPlanInput } from '@/domain/notifications';
import { todayLocal } from '@/domain/date';
import * as notificationRepository from '@/repositories/notificationRepository';
import { createId } from '@/utils/id';

import { writeDropletAttachment } from './notificationArt';

export const CATEGORY_ID = 'aquis-hydration';
export const ACTION_LOG = 'aquis-log-250';
export const ACTION_LOG_ML = 250;
/**
 * Android fixes a channel's sound when it is created, so there are two: one
 * with the AQUIS drop, one silent (a vibration only). The Sounds switch in
 * Profile picks between them.
 */
const CHANNEL_SOUND = 'hydration-sound';
const CHANNEL_QUIET = 'hydration-quiet';

/**
 * A custom notification sound has to be compiled into the app, which Expo Go
 * cannot do — there the system sound plays instead. Real builds bundle
 * assets/sounds/aquis_drop.wav through the expo-notifications plugin.
 */
const IN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const NOTIFICATION_SOUND = IN_EXPO_GO ? 'default' : 'aquis_drop.wav';

function soundFields(sound: boolean) {
  return {
    sound: sound ? NOTIFICATION_SOUND : false,
    channelId: sound ? CHANNEL_SOUND : CHANNEL_QUIET,
  } as const;
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';
let configured = false;

/** Handler, Android channel and the "Log 250 ml" action. Safe to call repeatedly. */
export function configureNotifications(): void {
  if (!supported || configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const id = notification.request.identifier;
      void notificationRepository.markShown(id).catch(() => {});
      // The one live "user is busy on the phone" signal Expo exposes: they are
      // looking at AQUIS right now. Stay silent — the glass is on screen (10).
      const data = notification.request.content.data as { sound?: boolean } | undefined;
      const quiet = AppState.currentState === 'active';
      return {
        shouldShowBanner: !quiet,
        shouldShowList: !quiet,
        shouldPlaySound: !quiet && data?.sound === true,
        shouldSetBadge: false,
      };
    },
  });

  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL_SOUND, {
      name: 'Hydration reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: NOTIFICATION_SOUND,
      vibrationPattern: [0, 120],
      lightColor: '#B2F966',
    }).catch(() => {});
    void Notifications.setNotificationChannelAsync(CHANNEL_QUIET, {
      name: 'Hydration reminders (silent)',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [0, 120],
      lightColor: '#B2F966',
    }).catch(() => {});
  }

  void Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      identifier: ACTION_LOG,
      buttonTitle: `Log ${ACTION_LOG_ML} ml 💧`,
      options: { opensAppToForeground: true },
    },
  ]).catch(() => {});
}

export async function getPermission(): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  try {
    const status = await Notifications.getPermissionsAsync();
    if (status.granted) return 'granted';
    return status.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** 06.6 — asked only after the value has been explained, never on launch. */
export async function requestPermission(): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    if (!current.canAskAgain) return 'denied';
    const next = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: false, allowBadge: false },
    });
    return next.granted ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export type SyncInput = Omit<ReminderPlanInput, 'now' | 'deliveredToday'> & {
  /** Today's total and target, shown in each reminder. */
  consumedMl: number;
  goalMl: number;
  /** Play the notification sound (Profile → Sounds). */
  sound: boolean;
};

let queue: Promise<unknown> = Promise.resolve();

/**
 * False after sign-out or a data reset. A re-plan that was already on its way
 * (from a log a moment earlier) then cancels instead of scheduling, so no
 * reminder outlives the account that asked for it.
 */
let active = true;

export function setRemindersActive(next: boolean): void {
  active = next;
}

/**
 * Replace every pending reminder with a fresh plan. Calls are serialised so a
 * burst of logs cannot interleave two schedules. Resolves to the scheduled
 * times, soonest first.
 */
export function syncReminders(input: SyncInput): Promise<number[]> {
  const run = queue.then(() => doSync(input));
  queue = run.catch(() => {});
  return run;
}

async function doSync(input: SyncInput): Promise<number[]> {
  if (!supported) return [];

  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});

  const permission = await getPermission();
  if (!active || !input.enabled || permission !== 'granted') {
    await notificationRepository.clearPlanned();
    return [];
  }

  const now = Date.now();
  const today = todayLocal();
  const deliveredToday = await notificationRepository.countDelivered(today, now);
  const plan = planReminders({ ...input, now, deliveredToday }).map((item) => ({
    ...item,
    id: createId('ntf'),
  }));

  for (const [index, item] of plan.entries()) {
    const forToday = item.date === today;
    const fill = forToday && input.goalMl > 0 ? Math.min(input.consumedMl / input.goalMl, 1) : 0;
    // iOS shows the droplet, filled to today's level, beside the text.
    const art = Platform.OS === 'ios' ? writeDropletAttachment(fill, item.id) : null;
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: {
        title: titleFor(item.at, index),
        body: reminderBody({ forToday, consumedMl: input.consumedMl, goalMl: input.goalMl }),
        categoryIdentifier: CATEGORY_ID,
        data: { kind: 'hydration', url: '/', sound: input.sound },
        sound: soundFields(input.sound).sound,
        color: '#B2F966',
        ...(art
          ? { attachments: [{ identifier: 'droplet', url: art, type: null, typeHint: 'public.png' }] }
          : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(item.at),
        channelId: soundFields(input.sound).channelId,
      },
    });
  }

  await notificationRepository.replacePlanned(plan, now);
  return plan.map((item) => item.at);
}

export function cancelAllReminders(): Promise<void> {
  active = false;
  if (!supported) return Promise.resolve();
  // Through the same queue as syncs, so it lands after any in-flight re-plan.
  const run = queue.then(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    await notificationRepository.clearPlanned();
  });
  queue = run.catch(() => {});
  return run;
}

export interface ReminderResponse {
  id: string;
  logRequested: boolean;
}

function toResponse(response: Notifications.NotificationResponse): ReminderResponse | null {
  const data = response.notification.request.content.data as { kind?: string } | undefined;
  if (data?.kind !== 'hydration') return null;
  return {
    id: response.notification.request.identifier,
    logRequested: response.actionIdentifier === ACTION_LOG,
  };
}

/**
 * Subscribes to taps and action presses, including the one that cold-started
 * the app. Each response is delivered once.
 */
export function subscribeToResponses(onResponse: (response: ReminderResponse) => void): () => void {
  if (!supported) return () => {};
  const seen = new Set<string>();
  const deliver = (raw: Notifications.NotificationResponse | null) => {
    if (!raw) return;
    const response = toResponse(raw);
    if (!response || seen.has(response.id + raw.actionIdentifier)) return;
    seen.add(response.id + raw.actionIdentifier);
    void notificationRepository
      .markAction(response.id, response.logRequested ? 'logged' : 'opened')
      .catch(() => {});
    onResponse(response);
  };

  void Notifications.getLastNotificationResponseAsync()
    .then((last) => {
      deliver(last);
      return Notifications.clearLastNotificationResponseAsync();
    })
    .catch(() => {});

  const subscription = Notifications.addNotificationResponseReceivedListener(deliver);
  return () => subscription.remove();
}
