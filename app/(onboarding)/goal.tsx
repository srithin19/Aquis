/**
 * Goal setup — Product Bible 06.4.
 *
 * "Tapping a target animates water level to the corresponding scale."
 *
 * The droplet here is a *scale* preview, not progress: the level shows the
 * chosen target against the largest preset, so 3 L fills it.
 */

import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Mascot } from '@/components/Mascot';
import { Body, Button, Caption, Notice, OptionCard, Screen, Spacer, Title } from '@/components/ui';
import {
  GOAL_PRESETS_ML,
  formatVolume,
  MAX_GOAL_ML,
  validateGoalAmount,
} from '@/domain/hydration';
import { useAppState } from '@/state/AppProvider';
import { useOnboarding } from '@/state/OnboardingProvider';
import { color, radius, spacing, typography } from '@/theme';

/** The preset that fills the preview droplet. */
const VISUAL_FULL_ML = GOAL_PRESETS_ML[GOAL_PRESETS_ML.length - 1];

export default function GoalSetupScreen() {
  const { reduceMotion, settings, activeGoal } = useAppState();
  const { dailyGoalMl, setDailyGoalMl, seed } = useOnboarding();

  // Starting a new goal from inside the app: begin from what the user has now,
  // including their reminder choice, instead of the first-run defaults.
  useEffect(() => {
    if (!settings.onboardingCompleted) return;
    seed({
      dailyGoalMl: activeGoal?.dailyGoalMl ?? dailyGoalMl,
      durationDays: activeGoal?.durationDays ?? 7,
      notificationsEnabled: settings.notificationsEnabled,
    });
    // Once, on arrival.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isPreset = useMemo(
    () => (GOAL_PRESETS_ML as readonly number[]).includes(dailyGoalMl),
    [dailyGoalMl],
  );

  const applyCustom = () => {
    const result = validateGoalAmount(customValue);
    if (!result.ok) {
      setError(result.message ?? null);
      return;
    }
    setError(null);
    setDailyGoalMl(result.value as number);
    setCustomMode(false);
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View>
        <Title center>How much water a day?</Title>
        <Spacer size={spacing.sm} />
        <Body tone="secondary" center>
          Pick a daily target. You can change it whenever you like.
        </Body>

        <View style={styles.preview}>
          <Mascot
            state={dailyGoalMl >= VISUAL_FULL_ML ? 'excited' : 'happy'}
            size={168}
            reduceMotion={reduceMotion}
            fill={Math.min(dailyGoalMl / VISUAL_FULL_ML, 1)}
            pokeKey={dailyGoalMl}
          />
          <View style={styles.previewLabel}>
            <Title style={styles.previewValue}>{formatVolume(dailyGoalMl)}</Title>
          </View>
        </View>

        <View style={styles.grid}>
          {GOAL_PRESETS_ML.map((preset) => (
            <OptionCard
              key={preset}
              title={formatVolume(preset)}
              subtitle={`${preset} ml`}
              selected={dailyGoalMl === preset}
              onPress={() => {
                setError(null);
                setCustomMode(false);
                setDailyGoalMl(preset);
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
              placeholder={`Millilitres (up to ${MAX_GOAL_ML})`}
              placeholderTextColor={color.textMuted}
              selectionColor={color.accent}
              keyboardType="number-pad"
              inputMode="numeric"
              returnKeyType="done"
              onSubmitEditing={applyCustom}
              style={styles.input}
              accessibilityLabel="Custom daily target in millilitres"
            />
            <Button label="Use this target" variant="secondary" onPress={applyCustom} />
          </View>
        ) : (
          <Button
            label={isPreset ? 'Set a custom amount' : `Custom: ${formatVolume(dailyGoalMl)}`}
            variant="ghost"
            onPress={() => {
              setCustomValue(isPreset ? '' : String(dailyGoalMl));
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
        <Button
          label="Continue"
          onPress={() => {
            // A typed custom value counts even if "Use this target" wasn't tapped.
            if (customMode && customValue.trim()) {
              const result = validateGoalAmount(customValue);
              if (!result.ok) {
                setError(result.message ?? null);
                return;
              }
              setDailyGoalMl(result.value as number);
              setCustomMode(false);
            }
            router.push('/(onboarding)/duration');
          }}
        />
        <Spacer size={spacing.md} />
        <Caption tone="muted" center>
          General wellness guidance, not medical advice.
        </Caption>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  preview: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  previewLabel: {
    marginTop: spacing.md,
    backgroundColor: color.accentWash,
    borderWidth: 1,
    borderColor: color.accentSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  previewValue: {
    color: color.accentStrong,
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
