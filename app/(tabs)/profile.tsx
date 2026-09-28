/**
 * Profile / Settings — Product Bible 06.15.
 *
 * "Keep mascot absent or extremely subtle; settings should feel calm and
 * utility-focused." No mascot here by design.
 */

import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useTabBarInset } from '@/components/layout';
import { Body, BodyStrong, Caption, Card, Chip, Divider, SectionLabel, Title } from '@/components/ui';
import { formatDayLabel } from '@/domain/date';
import { daysRemaining, describeDuration, goalDayNumber } from '@/domain/goals';
import { DEFAULT_QUICK_ADD_ML, formatVolume } from '@/domain/hydration';
import { countDaysWithEntries } from '@/repositories/hydrationRepository';
import { play, setSoundsEnabled } from '@/services/sound';
import { formatClock, parseClock } from '@/domain/notifications';
import { useAppState } from '@/state/AppProvider';
import { color, font, gradient, palette, radius, spacing } from '@/theme';

const QUICK_ADD_SETS: number[][] = [
  [150, 250, 500],
  [200, 300, 600],
  [250, 500, 750],
];

const QUIET_STEP_MIN = 30;

export default function ProfileScreen() {
  const {
    profile,
    settings,
    activeGoal,
    today,
    notificationPermission,
    systemReduceMotion,
    stats,
    revision,
    updateSettings,
    setRemindersEnabled,
    resetLocalData,
    signOut,
  } = useAppState();
  const bottomInset = useTabBarInset();
  const [busy, setBusy] = useState(false);
  const [daysRecorded, setDaysRecorded] = useState(0);

  // Refresh the day count whenever the data changes.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void countDaysWithEntries()
        .then((days) => {
          if (active) setDaysRecorded(days);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [revision]),
  );

  const confirmReset = () => {
    Alert.alert(
      'Reset local data?',
      'This clears your goals, history, badges and every logged entry on this device. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await resetLocalData();
              router.replace('/');
            } catch {
              Alert.alert('Could not reset', 'Something went wrong clearing local data. Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'Your hydration history stays on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        onPress: async () => {
          setBusy(true);
          try {
            await signOut();
            router.replace('/');
          } catch {
            Alert.alert('Could not sign out', 'Please try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const toggleReminders = async (next: boolean) => {
    const permission = await setRemindersEnabled(next);
    if (next && permission === 'denied') {
      Alert.alert(
        'Notifications are blocked',
        'AQUIS can only nudge you once notifications are allowed for it in system settings.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => void Linking.openSettings() },
        ],
      );
    }
  };

  // The steppers track their own latest value, so quick taps each count even
  // before the previous save has come back from the database.
  const quiet = useRef({ quietStart: settings.quietStart, quietEnd: settings.quietEnd });
  useEffect(() => {
    quiet.current = { quietStart: settings.quietStart, quietEnd: settings.quietEnd };
  }, [settings.quietStart, settings.quietEnd]);
  const shiftQuiet = (key: 'quietStart' | 'quietEnd', delta: number) => {
    const next = formatClock(parseClock(quiet.current[key]) + delta);
    quiet.current = { ...quiet.current, [key]: next };
    void updateSettings({ [key]: next });
  };

  const initials = (profile?.displayName ?? profile?.email ?? 'A').slice(0, 1).toUpperCase();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <Title>Profile</Title>

        {/* Account */}
        <Card style={styles.account}>
          {profile?.photoUrl ? (
            <Image source={{ uri: profile.photoUrl }} style={styles.avatar} accessibilityLabel="Your Google photo" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: gradient.primary[0] }]}>
              <Title tone="onAccent" style={styles.avatarText}>
                {initials}
              </Title>
            </View>
          )}
          <View style={styles.flex}>
            <BodyStrong>{profile?.displayName ?? 'AQUIS member'}</BodyStrong>
            {profile?.email ? <Caption tone="muted">{profile.email}</Caption> : null}
            <Caption tone="faint">
              {profile?.provider === 'google' ? 'Signed in with Google' : 'Saved on this phone'}
            </Caption>
          </View>
        </Card>

        {/* Current goal summary */}
        <SectionLabel style={styles.section}>Current goal</SectionLabel>
        <Card>
          {activeGoal ? (
            <>
              <View style={styles.goalRow}>
                <View>
                  <Title style={styles.goalValue}>{formatVolume(activeGoal.dailyGoalMl)}</Title>
                  <Caption tone="muted">a day · {describeDuration(activeGoal.durationDays)}</Caption>
                </View>
                <View style={styles.goalDay}>
                  <BodyStrong tone="accent">
                    Day {goalDayNumber(activeGoal, today)}/{activeGoal.durationDays}
                  </BodyStrong>
                  <Caption tone="muted">
                    {daysRemaining(activeGoal, today)} left · ends {formatDayLabel(activeGoal.endDate).split(',')[0]}
                  </Caption>
                </View>
              </View>
            </>
          ) : (
            <Body tone="secondary">No active goal.</Body>
          )}
          <Divider />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(onboarding)/goal')}
            style={styles.linkRow}
          >
            <BodyStrong tone="accent">{activeGoal ? 'Start a new goal' : 'Set a goal'}</BodyStrong>
            <Icon name="chevronRight" size={18} color={color.accent} />
          </Pressable>
          {activeGoal ? (
            <Caption tone="muted" style={styles.note}>
              A new goal starts a new period. Days already logged keep their original target.
            </Caption>
          ) : null}
        </Card>

        {/* Notification settings */}
        <SectionLabel style={styles.section}>Reminders</SectionLabel>
        <Card>
          <ToggleRow
            label="Hydration reminders"
            hint={
              notificationPermission === 'denied' && settings.notificationsEnabled
                ? 'Blocked in system settings — tap to fix.'
                : 'Randomized around a 3-hour rhythm. Never right after a drink.'
            }
            value={settings.notificationsEnabled}
            onChange={(next) => void toggleReminders(next)}
            onHintPress={notificationPermission === 'denied' ? () => void Linking.openSettings() : undefined}
          />
          <Divider />
          <ToggleRow
            label="Remind me after my goal"
            hint="Off by default — AQUIS goes quiet once you hit 100%."
            value={settings.postGoalRemindersEnabled}
            onChange={(next) => void updateSettings({ postGoalRemindersEnabled: next })}
          />
          <Divider />
          <Body>Quiet hours</Body>
          <Caption tone="muted">No nudges between these times.</Caption>
          <View style={styles.quietRow}>
            <TimeStepper
              label="From"
              value={settings.quietStart}
              onMinus={() => shiftQuiet('quietStart', -QUIET_STEP_MIN)}
              onPlus={() => shiftQuiet('quietStart', QUIET_STEP_MIN)}
            />
            <TimeStepper
              label="Until"
              value={settings.quietEnd}
              onMinus={() => shiftQuiet('quietEnd', -QUIET_STEP_MIN)}
              onPlus={() => shiftQuiet('quietEnd', QUIET_STEP_MIN)}
            />
          </View>
        </Card>

        {/* Default quick-add values (06.15) */}
        <SectionLabel style={styles.section}>Quick-add amounts</SectionLabel>
        <Card>
          <View style={styles.chips}>
            {QUICK_ADD_SETS.map((set) => (
              <Chip
                key={set.join('-')}
                label={`${set.join(' · ')} ml`}
                selected={set.join(',') === settings.quickAddMl.join(',')}
                onPress={() => void updateSettings({ quickAddMl: set })}
              />
            ))}
          </View>
          {settings.quickAddMl.join(',') !== DEFAULT_QUICK_ADD_ML.join(',') ? (
            <Pressable
              accessibilityRole="button"
              style={styles.resetDefault}
              onPress={() => void updateSettings({ quickAddMl: [...DEFAULT_QUICK_ADD_ML] })}
            >
              <Caption tone="accent">Reset to default</Caption>
            </Pressable>
          ) : null}
        </Card>

        {/* Accessibility */}
        <SectionLabel style={styles.section}>Motion &amp; feedback</SectionLabel>
        <Card>
          <ToggleRow
            label="Reduce motion"
            hint={
              systemReduceMotion
                ? 'Your phone’s Reduce Motion is on, so AQUIS keeps animations still. Turn it off in system Accessibility settings to see the mascot move.'
                : 'Replaces waves, loops and large movement with simple fades.'
            }
            value={settings.reduceMotion || systemReduceMotion}
            onChange={(next) => void updateSettings({ reduceMotion: next })}
          />
          <Divider />
          <ToggleRow
            label="Haptics"
            hint="A light tap when you log, a stronger one when you finish the day."
            value={settings.hapticsEnabled}
            onChange={(next) => void updateSettings({ hapticsEnabled: next })}
          />
          <Divider />
          <ToggleRow
            label="Sounds"
            hint="Soft effects in the app and a drop sound on reminders. Follows your phone’s silent switch."
            value={settings.soundsEnabled}
            onChange={(next) => {
              void updateSettings({ soundsEnabled: next });
              // A preview, so the user hears what they just switched on.
              if (next) {
                setSoundsEnabled(true);
                play('drop');
              }
            }}
          />
        </Card>

        {/* Where the data lives (13, 17). */}
        <SectionLabel style={styles.section}>Your data</SectionLabel>
        <Card>
          <Body tone="secondary">
            Everything is saved only on this phone, in a private local database. Nothing is uploaded.
          </Body>
          <View style={styles.dataRow}>
            <DataStat value={String(daysRecorded)} label="days" />
            <DataStat value={String(stats.totalEntries)} label="drinks" />
            <DataStat value={formatVolume(stats.totalMl)} label="total" />
          </View>
          <Caption tone="muted">
            Each day closes at midnight: it’s kept in your History calendar and Home starts fresh at 0.
          </Caption>
        </Card>

        {/* About / privacy (17) */}
        <SectionLabel style={styles.section}>About</SectionLabel>
        <Card>
          <Body tone="secondary">
            AQUIS keeps everything on this device. No account sync, no analytics upload, no ads.
          </Body>
          <Caption tone="muted" style={styles.note}>
            AQUIS offers general wellness guidance. It is not a medical device and does not diagnose
            dehydration.
          </Caption>
          <Caption tone="faint" style={styles.note}>
            Version 1.0.0
          </Caption>
        </Card>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={confirmSignOut}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          >
            <BodyStrong tone="accent">Sign out</BodyStrong>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={confirmReset}
            style={({ pressed }) => [styles.actionButton, styles.destructiveButton, pressed && styles.pressed]}
          >
            <BodyStrong style={styles.destructive}>Reset local data</BodyStrong>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DataStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.dataStat}>
      <BodyStrong style={styles.dataValue}>{value}</BodyStrong>
      <Caption tone="muted">{label}</Caption>
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
  onHintPress,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
  onHintPress?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Body>{label}</Body>
        <Caption tone={onHintPress ? 'accent' : 'muted'} onPress={onHintPress}>
          {hint}
        </Caption>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: palette.teal500, false: 'rgba(255,255,255,0.12)' }}
        thumbColor={palette.text50}
        ios_backgroundColor="rgba(255,255,255,0.12)"
        accessibilityLabel={label}
      />
    </View>
  );
}

function TimeStepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Caption tone="muted">{label}</Caption>
      <View style={styles.stepperRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} earlier`} onPress={onMinus} hitSlop={6} style={styles.stepButton}>
          <Icon name="minus" size={14} color={color.textSecondary} strokeWidth={2.4} />
        </Pressable>
        <BodyStrong style={styles.stepValue}>{value}</BodyStrong>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} later`} onPress={onPlus} hitSlop={6} style={styles.stepButton}>
          <Icon name="plus" size={14} color={color.textSecondary} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    lineHeight: 26,
  },
  section: {
    marginTop: spacing.xl,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  goalValue: {
    color: palette.teal300,
  },
  goalDay: {
    alignItems: 'flex-end',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  note: {
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  quietRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  stepper: {
    flex: 1,
    backgroundColor: color.surfaceSunk,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceStrong,
  },
  stepValue: {
    fontFamily: font.display,
    fontSize: 20,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  resetDefault: {
    marginTop: spacing.md,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  destructiveButton: {
    borderColor: 'rgba(242,139,130,0.3)',
  },
  destructive: {
    color: palette.coral400,
  },
  pressed: {
    opacity: 0.7,
  },
  dataRow: {
    flexDirection: 'row',
    marginVertical: spacing.md,
  },
  dataStat: {
    flex: 1,
  },
  dataValue: {
    fontFamily: font.display,
    fontSize: 20,
    lineHeight: 26,
  },
});
