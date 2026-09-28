/**
 * Notification setup — Product Bible 06.6.
 *
 * "Explain that AQUIS does not simply ping every hour... System permission is
 * requested only after the value is explained."
 *
 * Phase 1–2 scope: this screen explains the cadence and records the preference
 * in `AppSettings`. The OS permission prompt belongs to Phase 3 alongside the
 * engine that would use it — asking for it now would be a permission the app
 * cannot yet honour, which 17 explicitly warns against ("ask only for
 * permissions that are required").
 */

import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Mascot } from '@/components/Mascot';
import { Body, BodyStrong, Button, Caption, Card, Screen, Spacer, Title } from '@/components/ui';
import { useAppState } from '@/state/AppProvider';
import { useOnboarding } from '@/state/OnboardingProvider';
import { requestPermission } from '@/services/notificationService';
import { palette, spacing } from '@/theme';

const PROMISES = [
  'Reminders arrive around a 3-hour rhythm, at a moment picked inside that window — never on the hour, every hour.',
  'Nothing lands right after you have just had a drink.',
  'Once you hit your goal, AQUIS goes quiet for the rest of the day.',
  'Quiet hours are respected, and missed reminders never pile up into a burst.',
];

export default function NotificationSetupScreen() {
  const { reduceMotion } = useAppState();
  const { notificationsEnabled, setNotificationsEnabled } = useOnboarding();
  const [busy, setBusy] = useState(false);

  // 06.6 — the OS prompt appears only now, after the value has been explained,
  // and only if the user chose reminders.
  const handleContinue = async () => {
    setBusy(true);
    if (notificationsEnabled) {
      const permission = await requestPermission();
      if (permission === 'denied') setNotificationsEnabled(false);
    }
    setBusy(false);
    router.push('/(onboarding)/mascot');
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Mascot state={notificationsEnabled ? 'happy' : 'sleepy'} size={92} reduceMotion={reduceMotion} />
        <Spacer size={spacing.lg} />
        <Title center>Considerate reminders</Title>
        <Spacer size={spacing.sm} />
        <Body tone="secondary" center>
          AQUIS is built to interrupt you as little as possible.
        </Body>
      </View>

      <Spacer size={spacing.xl} />

      <Card>
        {PROMISES.map((promise, index) => (
          <View key={promise} style={[styles.promise, index > 0 && styles.promiseSpaced]}>
            <View style={styles.dot} />
            <Body tone="secondary" style={styles.promiseText}>
              {promise}
            </Body>
          </View>
        ))}
      </Card>

      <Spacer size={spacing.lg} />

      <Card style={styles.toggleCard}>
        <View style={styles.toggleText}>
          <BodyStrong>Hydration reminders</BodyStrong>
          <Caption tone="muted">You can change this any time in Profile.</Caption>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
          trackColor={{ true: palette.teal500, false: 'rgba(255,255,255,0.12)' }}
          thumbColor={palette.text50}
          ios_backgroundColor="rgba(255,255,255,0.12)"
          accessibilityLabel="Enable hydration reminders"
        />
      </Card>

      <Spacer size={spacing.xl} />
      <Button label={busy ? 'One moment…' : 'Continue'} disabled={busy} onPress={() => void handleContinue()} />
      <Spacer size={spacing.md} />
      <Caption tone="muted" center>
        AQUIS works fully without reminders — the glass and your history do not depend on them.
      </Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
  },
  promise: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  promiseSpaced: {
    marginTop: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.teal400,
    marginTop: 8,
    marginRight: spacing.md,
  },
  promiseText: {
    flex: 1,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  toggleText: {
    flex: 1,
  },
});
