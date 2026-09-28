/**
 * Custom water entry — Product Bible 06.10.
 *
 * "Numeric amount entry. Optional quick chips. Confirm / Cancel. Validate
 * positive amount and reasonable maximum per entry. Store exact amount and
 * timestamp." The preview droplet fills live to where today would land.
 */

import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { Mascot } from '@/components/Mascot';
import { BodyStrong, Button, Caption, Chip, Micro, Notice, Screen, Title } from '@/components/ui';
import { MAX_ENTRY_ML, formatVolume, validateEntryAmount } from '@/domain/hydration';
import { useAppState } from '@/state/AppProvider';
import { color, font, radius, spacing, spring } from '@/theme';
import { haptic } from '@/utils/haptics';

const CHIPS = [100, 200, 330, 400, 600, 750];

export default function CustomAmountScreen() {
  const { logWater, consumedMl, goalMl, reduceMotion } = useAppState();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A ref, not state: a double tap (or keyboard submit + button) logs once.
  const savingRef = useRef(false);
  const focus = useSharedValue(1);

  const parsed = useMemo(() => validateEntryAmount(value), [value]);
  const amount = parsed.ok ? (parsed.value as number) : 0;

  // Preview: where this entry would leave today's droplet.
  const previewProgress = goalMl > 0 ? Math.min((consumedMl + amount) / goalMl, 1) : 0;
  const previewPercent = goalMl > 0 ? Math.round(Math.min((consumedMl + amount) / goalMl, 1) * 100) : 0;

  // "Input focus uses soft scale."
  const inputStyle = useAnimatedStyle(() => ({ transform: [{ scale: focus.value }] }));

  const confirm = async () => {
    if (savingRef.current) return;
    const result = validateEntryAmount(value);
    if (!result.ok) {
      setError(result.message ?? null);
      return;
    }
    savingRef.current = true;
    setBusy(true);
    try {
      const outcome = await logWater(result.value as number, 'custom');
      haptic(outcome.justCompleted ? 'success' : 'light');
      router.back();
    } catch (cause) {
      savingRef.current = false;
      setBusy(false);
      setError(cause instanceof Error ? cause.message : 'Could not save that entry.');
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View>
        <View style={styles.topBar}>
          <Micro tone="muted">CUSTOM AMOUNT</Micro>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10} onPress={() => router.back()} style={styles.close}>
            <Icon name="close" size={18} color={color.textSecondary} />
          </Pressable>
        </View>

        <Title center>How much did you drink?</Title>

        <View style={styles.previewRow}>
          <Mascot
            state={amount > 0 ? (previewProgress >= 1 ? 'celebrating' : 'excited') : 'thinking'}
            size={120}
            reduceMotion={reduceMotion}
            fill={previewProgress}
            pokeKey={amount}
          />
          <View style={styles.previewText}>
            <Caption tone="muted">Today would reach</Caption>
            <BodyStrong style={styles.previewValue}>{formatVolume(consumedMl + amount)}</BodyStrong>
            <Caption tone="accent">
              {previewPercent}% of {formatVolume(goalMl)}
            </Caption>
          </View>
        </View>

        <Animated.View style={[styles.inputWrap, inputStyle]}>
          <TextInput
            value={value}
            onChangeText={(next) => {
              setValue(next.replace(/[^0-9]/g, ''));
              setError(null);
            }}
            onFocus={() => {
              focus.value = withSpring(1.03, spring.card);
            }}
            onBlur={() => {
              focus.value = withSpring(1, spring.card);
            }}
            placeholder="0"
            placeholderTextColor={color.textFaint}
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="done"
            onSubmitEditing={() => void confirm()}
            autoFocus
            maxLength={4}
            selectionColor={color.accent}
            style={styles.input}
            accessibilityLabel="Amount in millilitres"
          />
          <Caption tone="muted" center>
            millilitres (up to {MAX_ENTRY_ML})
          </Caption>
        </Animated.View>

        <View style={styles.chips}>
          {CHIPS.map((chip) => (
            <Chip
              key={chip}
              label={`${chip} ml`}
              selected={value === String(chip)}
              onPress={() => {
                setValue(String(chip));
                setError(null);
              }}
            />
          ))}
        </View>

        {error ? <Notice text={error} tone="accent" /> : null}

        <View style={styles.actions}>
          <Button
            label={busy ? 'Saving…' : amount > 0 ? `Add ${amount} ml` : 'Add to today'}
            disabled={busy || !parsed.ok}
            onPress={() => void confirm()}
          />
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surfaceStrong,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginVertical: spacing.xl,
  },
  previewText: {
    alignItems: 'flex-start',
    gap: 2,
  },
  previewValue: {
    fontFamily: font.display,
    fontSize: 26,
    lineHeight: 32,
  },
  inputWrap: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.accentSoft,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  input: {
    fontFamily: font.display,
    fontSize: 56,
    lineHeight: 64,
    color: color.textPrimary,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});
