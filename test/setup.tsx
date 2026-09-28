/**
 * Test doubles for the parts of the app that need a real phone.
 *
 * Only native edges are replaced: navigation, notifications, haptics, fonts and
 * the Skia-drawn visuals. Every screen, the provider, the repositories and the
 * SQL (via the sql.js shim) are the real code. Each double records what the
 * app asked it to do, so tests can assert on it.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

/* ---------------------------------------------------------------- router */

jest.mock('expo-router', () => {
  const React = require('react');
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
  const params: Record<string, string> = {};
  const Passthrough = ({ children }: { children?: React.ReactNode }) => children ?? null;
  const Stack = Object.assign(Passthrough, { Screen: () => null });
  const Tabs = Object.assign(Passthrough, { Screen: () => null });
  return {
    router,
    Stack,
    Tabs,
    DarkTheme: { dark: true, colors: {}, fonts: {} },
    ThemeProvider: Passthrough,
    useLocalSearchParams: () => params,
    __params: params,
    // Run focus effects like a mount effect.
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});

/* --------------------------------------------------------- notifications */

jest.mock('expo-notifications', () => {
  const scheduled: unknown[] = [];
  return {
    __scheduled: scheduled,
    __permission: { granted: true, canAskAgain: true },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    setNotificationCategoryAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(async function (this: void) {
      return require('expo-notifications').__permission;
    }),
    requestPermissionsAsync: jest.fn(async () => require('expo-notifications').__permission),
    scheduleNotificationAsync: jest.fn(async (request: { identifier: string }) => {
      scheduled.push(request);
      return request.identifier;
    }),
    cancelAllScheduledNotificationsAsync: jest.fn(async () => {
      scheduled.length = 0;
    }),
    getLastNotificationResponseAsync: jest.fn(async () => null),
    clearLastNotificationResponseAsync: jest.fn(async () => undefined),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  };
});

jest.mock('@/services/notificationArt', () => ({
  renderDropletBase64: () => null,
  writeDropletAttachment: () => null,
}));

/* --------------------------------------------------------- google sign-in */

// Tests run as a real build (not Expo Go) unless a test says otherwise.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare', expoConfig: {} },
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({
      type: 'success',
      data: {
        user: {
          id: 'google-123',
          email: 'Sri.C@Gmail.com',
          name: 'Sri C',
          givenName: 'Sri',
          familyName: 'C',
          photo: 'https://example.com/sri.png',
        },
        idToken: 'token',
        scopes: [],
        serverAuthCode: null,
      },
    })),
    signOut: jest.fn(async () => null),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
  },
}));

/* ------------------------------------------------------------ device bits */

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(async () => undefined) }));
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

/* ------------------------------------------------------- Skia-drawn parts */

// The mascot is drawn with Skia. In tests it is a plain view that reports its
// current mood and fill level, so reactions can be asserted.
jest.mock('@/components/Mascot', () => {
  const React = require('react');
  const { View } = require('react-native');
  const TAP_REACTIONS = ['giggle', 'wink', 'surprised', 'love'];
  const tapReactionFor = (pokeKey: number) => TAP_REACTIONS[(Math.max(pokeKey, 1) - 1) % 4];
  function Mascot({ state = 'idle', fill, pokeKey = 0 }: { state?: string; fill?: number; pokeKey?: number }) {
    const shown = pokeKey > 0 ? tapReactionFor(pokeKey) : state;
    return React.createElement(View, {
      testID: 'mascot',
      accessibilityValue: { text: `${shown}|${state}|${fill ?? 'solid'}` },
    });
  }
  return { Mascot, MascotStage: Mascot, TAP_REACTIONS, tapReactionFor };
});

jest.mock('@/components/ProgressRing', () => ({ ProgressRing: () => null }));

/* ----------------------------------------------------------------- alerts */

// Alert.alert presses the button whose text matches `__alertChoice` (default:
// the last, i.e. the confirming one) and records every alert shown.
const RN = require('react-native');
const alerts: { title: string; message?: string }[] = [];
(global as unknown as { __alerts: typeof alerts }).__alerts = alerts;
RN.Alert.alert = jest.fn(
  (title: string, message?: string, buttons?: { text: string; onPress?: () => void }[]) => {
    alerts.push({ title, message });
    const choice = (global as unknown as { __alertChoice?: string }).__alertChoice;
    const button = buttons?.find((b) => b.text === choice) ?? buttons?.[buttons.length - 1];
    button?.onPress?.();
  },
);
RN.Linking.openSettings = jest.fn(async () => undefined);

// Dev analytics prints every event; keep test output readable.
jest.spyOn(console, 'log').mockImplementation(() => {});

/* ------------------------------------------------------------------ audio */

// Records every sound actually played (after the Sounds switch is checked).
jest.mock('expo-audio', () => {
  const played: number[] = [];
  return {
    __played: played,
    setAudioModeAsync: jest.fn(async () => undefined),
    createAudioPlayer: jest.fn(() => {
      const p = {
        volume: 1,
        seekTo: jest.fn(async () => undefined),
        play: jest.fn(() => played.push(1)),
      };
      return p;
    }),
  };
});
