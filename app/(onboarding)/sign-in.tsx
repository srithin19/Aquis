/**
 * Authentication — Product Bible 06.3.
 *
 * Google and email both route through `authService`. V1 runs the local adapter
 * (see that file): the screens, the profile record and the navigation are real,
 * the credential check is the piece a provider fills in later.
 *
 * "Do not force profile completion before the hydration goal can be configured."
 */

import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Mascot } from '@/components/Mascot';
import { Body, Button, Caption, Notice, Screen, Spacer, Title } from '@/components/ui';
import { useAppState } from '@/state/AppProvider';
import { isValidEmail } from '@/services/authService';
import { color, radius, spacing, typography } from '@/theme';

export default function SignInScreen() {
  const { signIn, activeGoal, reduceMotion } = useAppState();
  const [mode, setMode] = useState<'choose' | 'email'>('choose');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const proceed = async (provider: 'google' | 'email', address?: string) => {
    setBusy(true);
    setError(null);
    try {
      await signIn({ provider, email: address });
      // Signing back in with a goal still running: pick up where you left off
      // instead of being made to replace it.
      if (activeGoal) router.dismissTo('/(tabs)');
      else router.replace('/(onboarding)/goal');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work. Try again?');
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = () => {
    if (!isValidEmail(email)) {
      setError('That email address looks incomplete.');
      return;
    }
    void proceed('email', email.trim().toLowerCase());
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View>
        <View style={styles.header}>
          <Mascot state="thinking" size={96} reduceMotion={reduceMotion} />
          <Spacer size={spacing.lg} />
          <Title center>Save your progress</Title>
          <Spacer size={spacing.sm} />
          <Body tone="secondary" center>
            Your hydration history stays on this device. An account just makes it yours.
          </Body>
        </View>

        <Spacer size={spacing.xxl} />

        {mode === 'choose' ? (
          <View style={styles.actions}>
            <Button
              label="Continue with Google"
              disabled={busy}
              onPress={() => void proceed('google')}
            />
            <Button
              label="Continue with email"
              variant="secondary"
              disabled={busy}
              onPress={() => setMode('email')}
            />
          </View>
        ) : (
          <View style={styles.actions}>
            <TextInput
              value={email}
              onChangeText={(next) => {
                setEmail(next);
                setError(null);
              }}
              placeholder="you@example.com"
              placeholderTextColor={color.textMuted}
              selectionColor={color.accent}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              returnKeyType="go"
              onSubmitEditing={submitEmail}
              style={styles.input}
              accessibilityLabel="Email address"
            />
            <Button label="Continue" disabled={busy} onPress={submitEmail} />
            <Button label="Back" variant="ghost" onPress={() => setMode('choose')} />
          </View>
        )}

        {error ? (
          <>
            <Spacer size={spacing.md} />
            <Notice text={error} tone="accent" />
          </>
        ) : null}

        <Spacer size={spacing.xl} />
        <Caption tone="muted" center>
          AQUIS keeps your hydration data on this device. Nothing is uploaded.
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
  header: {
    alignItems: 'center',
  },
  actions: {
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
  },
});
