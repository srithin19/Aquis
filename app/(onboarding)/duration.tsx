/**
 * Goal duration — Product Bible 06.5.
 *
 * "Show 'Day 1 of N' preview. Only one active goal can exist at a time.
 * Changing a goal later creates a new goal period; historical days retain their
 * original goal."
 */

import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Mascot } from '@/components/Mascot';
import {
  Body,
  BodyStrong,
  Button,
  Caption,
  Card,
  Notice,
  OptionCard,
  Screen,
  Spacer,
  Title,
} from '@/components/ui';
import { addDays, formatDayLabel, todayLocal } from '@/domain/date';
import { describeDuration } from '@/domain/goals';
import {
  DURATION_PRESETS_DAYS,
  MAX_DURATION_DAYS,
  MIN_DURATION_DAYS,
  formatVolume,
} from '@/domain/hydration';
import { useAppState } from '@/state/AppProvider';
import { useOnboarding } from '@/state/OnboardingProvider';
import { color, radius, spacing, typography } from '@/theme';

export default function DurationScreen() {
  const { reduceMotion, settings } = useAppState();
  const { dailyGoalMl, durationDays, setDurationDays } = useOnboarding();
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isPreset = (DURATION_PRESETS_DAYS as readonly number[]).includes(durationDays);
  const start = todayLocal();
  const end = addDays(start, durationDays - 1);

  /** Returns false (and shows why) when the typed length is not usable. */
  const applyCustom = (): boolean => {
    const parsed = Number(customValue.trim());
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      setError('Enter a whole number of days.');
      return false;
    }
    if (parsed < MIN_DURATION_DAYS || parsed > MAX_DURATION_DAYS) {
      setError(`Goal periods run from ${MIN_DURATION_DAYS} to ${MAX_DURATION_DAYS} days.`);
      return false;
    }
    setError(null);
    setDurationDays(parsed);
    setCustomMode(false);
    return true;
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View>
        <View style={styles.header}>
          <Mascot state="thinking" size={92} reduceMotion={reduceMotion} pokeKey={durationDays} />
          <Spacer size={spacing.lg} />
          <Title center>How long should this run?</Title>
          <Spacer size={spacing.sm} />
          <Body tone="secondary" center>
            One goal at a time. When the period ends you will see how it went.
          </Body>
        </View>

        <Spacer size={spacing.xl} />

        <View style={styles.grid}>
          {DURATION_PRESETS_DAYS.map((preset) => (
            <OptionCard
              key={preset}
              compact
              title={`${preset} days`}
              subtitle={describeDuration(preset)}
              selected={durationDays === preset}
              onPress={() => {
                setError(null);
                setCustomMode(false);
                setDurationDays(preset);
              }}
            />
          ))}
        </View>

        <Spacer size={spacing.lg} />

        {customMode ? (
          <View style={styles.custom}>
            <TextInput
              value={customValue}
              onChangeText={(next) => {
                setCustomValue(next);
                setError(null);
              }}
              placeholder={`Days (${MIN_DURATION_DAYS}–${MAX_DURATION_DAYS})`}
              placeholderTextColor={color.textMuted}
              selectionColor={color.accent}
              keyboardType="number-pad"
              inputMode="numeric"
              returnKeyType="done"
              onSubmitEditing={applyCustom}
              style={styles.input}
              accessibilityLabel="Custom goal length in days"
            />
            <Button label="Use this length" variant="secondary" onPress={applyCustom} />
          </View>
        ) : (
          <Button
            label={isPreset ? 'Set a custom length' : `Custom: ${durationDays} days`}
            variant="ghost"
            onPress={() => {
              setCustomValue(isPreset ? '' : String(durationDays));
              setCustomMode(true);
            }}
          />
        )}

        {error ? (
          <>
            <Spacer size={spacing.sm} />
            <Notice text={error} tone="accent" />
          </>
        ) : null}

        <Spacer size={spacing.xl} />

        <Card>
          <Caption tone="muted">Preview</Caption>
          <Spacer size={spacing.xs} />
          <BodyStrong>Day 1 of {durationDays}</BodyStrong>
          <Spacer size={spacing.xs} />
          <Body tone="secondary">
            {formatVolume(dailyGoalMl)} a day, {formatDayLabel(start)} through {formatDayLabel(end)}.
          </Body>
        </Card>

        <Spacer size={spacing.xl} />
        <Button
          label="Continue"
          onPress={() => {
            if (customMode && customValue.trim() && !applyCustom()) return;
            // Someone who has onboarded already knows the reminder and mascot
            // screens — a new goal goes straight to confirmation.
            router.push(settings.onboardingCompleted ? '/(onboarding)/confirm' : '/(onboarding)/notifications');
          }}
        />
      </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  custom: {
    gap: spacing.sm,
  },
  input: {
    ...typography.body,
    color: color.textPrimary,
    backgroundColor: color.surfaceSunk,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.accentSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    minHeight: 54,
    textAlign: 'center',
  },
});
