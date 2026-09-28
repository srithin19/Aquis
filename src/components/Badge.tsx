/**
 * Badge medallion — Product Bible 06.14.
 *
 * Earned badges glow in their own gradient; locked ones are a dim glass disc
 * with a lock. The medallion shape is the droplet again, so every reward stays
 * inside the water language.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { AchievementTint } from '@/domain/achievements';
import { color, palette } from '@/theme';

import { Icon, type IconName } from './Icon';

export const TINTS: Record<AchievementTint, readonly [string, string]> = {
  aqua: [palette.teal300, palette.teal600],
  violet: [palette.lavender400, palette.lavender600],
  magenta: [palette.pink400, palette.lavender500],
  lime: [palette.lime400, palette.lime300],
  amber: [palette.orange400, palette.pink500],
};

const ICONS: Record<string, IconName> = {
  first_sip: 'drop',
  first_goal: 'check',
  seven_day_flow: 'flame',
  thirty_day_flow: 'flame',
  hydration_habit: 'sparkle',
  goal_crusher: 'medal',
  century_of_glasses: 'drop',
};

export function Badge({
  id,
  tint,
  earned,
  size = 56,
}: {
  id: string;
  tint: AchievementTint;
  earned: boolean;
  size?: number;
}) {
  const colors = TINTS[tint];
  const icon = earned ? ICONS[id] ?? 'medal' : 'lock';

  if (!earned) {
    return (
      <View style={[styles.locked, { width: size, height: size, borderRadius: size / 2 }]}>
        <Icon name={icon} size={size * 0.4} color={color.textFaint} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.glow,
        { width: size, height: size, borderRadius: size / 2, shadowColor: colors[0] },
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.fill, { borderRadius: size / 2 }]}
      >
        <View style={[styles.inner, { borderRadius: size / 2 - 4 }]}>
          <Icon name={icon} size={size * 0.44} color={palette.ink950} strokeWidth={2.3} />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  locked: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  glow: {
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  fill: {
    flex: 1,
    padding: 4,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
  },
});
