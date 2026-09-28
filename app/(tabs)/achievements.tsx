/**
 * Achievements — Product Bible 06.14 / 12.
 *
 * Current and longest streak, the badge catalogue with live progress, the next
 * milestone, and what was earned recently. Gamification stays gentle (19,
 * "What NOT to build": aggressive gamification): no leaderboards, no losses.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, TINTS } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { useTabBarInset } from '@/components/layout';
import { Body, BodyStrong, Caption, Card, enterUp, Hero, Micro, SectionLabel, Title } from '@/components/ui';
import { ACHIEVEMENTS } from '@/domain/achievements';
import { STREAK_MILESTONES } from '@/domain/streaks';
import { useAppState } from '@/state/AppProvider';
import { color, font, palette, radius, spacing } from '@/theme';

export default function AchievementsScreen() {
  const { streak, stats, earned, reduceMotion } = useAppState();
  const bottomInset = useTabBarInset();

  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak.current) ?? null;
  const earnedCount = ACHIEVEMENTS.filter((def) => earned.has(def.id)).length;

  const recent = useMemo(
    () =>
      [...earned.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, at]) => ({ def: ACHIEVEMENTS.find((d) => d.id === id), at }))
        .filter((r) => r.def),
    [earned],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <Title>Achievements</Title>
        <Caption tone="muted">
          {earnedCount} of {ACHIEVEMENTS.length} unlocked
        </Caption>

        {/* Streak hero. */}
        <LinearGradient
          colors={['rgba(235,179,107,0.22)', 'rgba(249,202,219,0.10)', 'rgba(28,28,28,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.streakCard}
        >
          <View style={styles.streakMain}>
            <View style={styles.flameBubble}>
              <Icon name="flame" size={30} color={palette.ink950} strokeWidth={2.3} />
            </View>
            <View>
              <Hero style={styles.streakNumber}>{streak.current}</Hero>
              <Caption tone="secondary">day streak</Caption>
            </View>
          </View>
          <View style={styles.streakSide}>
            <Micro tone="muted">LONGEST</Micro>
            <BodyStrong style={styles.longest}>{streak.longest} days</BodyStrong>
            {nextMilestone ? (
              <>
                <Micro tone="muted" style={styles.nextLabel}>
                  NEXT MILESTONE
                </Micro>
                <BodyStrong>{nextMilestone} days</BodyStrong>
              </>
            ) : null}
          </View>
        </LinearGradient>
        {nextMilestone ? (
          <View style={styles.milestoneTrack}>
            <LinearGradient
              colors={[palette.orange400, palette.pink400]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.milestoneFill, { width: `${Math.min((streak.current / nextMilestone) * 100, 100)}%` }]}
            />
          </View>
        ) : null}
        <Caption tone="muted" style={styles.rule}>
          A day counts when you reach 100% of that day&apos;s target.
        </Caption>

        {recent.length > 0 ? (
          <>
            <SectionLabel style={styles.section}>Recently earned</SectionLabel>
            <Card>
              {recent.map(({ def, at }, index) => (
                <View key={def!.id} style={[styles.recentRow, index > 0 && styles.recentSpaced]}>
                  <Badge id={def!.id} tint={def!.tint} earned size={40} />
                  <View style={styles.flex}>
                    <BodyStrong>{def!.name}</BodyStrong>
                    <Caption tone="muted">
                      {new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Caption>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionLabel style={styles.section}>All badges</SectionLabel>
        <View style={styles.grid}>
          {ACHIEVEMENTS.map((def, index) => {
            const got = earned.has(def.id);
            const [current, target] = def.progress(stats);
            const ratio = Math.min(current / target, 1);
            return (
              <Animated.View
                key={def.id}
                entering={enterUp(index * 35, reduceMotion)}
                style={[styles.tile, got && styles.tileEarned]}
              >
                <Badge id={def.id} tint={def.tint} earned={got} size={54} />
                <BodyStrong style={styles.tileName} numberOfLines={1}>
                  {def.name}
                </BodyStrong>
                <Caption tone="muted" center numberOfLines={2} style={styles.tileDesc}>
                  {def.description}
                </Caption>
                {got ? (
                  <Micro tone="success">UNLOCKED</Micro>
                ) : (
                  <View style={styles.progressWrap}>
                    <View style={styles.progressTrack}>
                      <LinearGradient
                        colors={TINTS[def.tint]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressFill, { width: `${Math.max(ratio * 100, 2)}%` }]}
                      />
                    </View>
                    <Micro tone="muted">
                      {current}/{target}
                    </Micro>
                  </View>
                )}
              </Animated.View>
            );
          })}
        </View>

        <Card style={styles.soon}>
          <Micro tone="violet">COMING LATER</Micro>
          <Body tone="secondary" style={styles.soonCopy}>
            Friends, shared challenges and gentle encouragement — always opt-in, never a leaderboard
            by default.
          </Body>
        </Card>
      </ScrollView>
    </SafeAreaView>
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
  streakCard: {
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(235,179,107,0.35)',
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  flameBubble: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.orange400,
    shadowColor: palette.orange400,
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  streakNumber: {
    color: palette.orange400,
  },
  streakSide: {
    alignItems: 'flex-end',
  },
  longest: {
    fontFamily: font.displayMedium,
  },
  nextLabel: {
    marginTop: spacing.sm,
  },
  milestoneTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  milestoneFill: {
    height: '100%',
    borderRadius: 3,
  },
  rule: {
    marginTop: spacing.sm,
  },
  section: {
    marginTop: spacing.xl,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recentSpaced: {
    marginTop: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  tileEarned: {
    borderColor: color.accentSoft,
    backgroundColor: 'rgba(178,249,102,0.06)',
  },
  tileName: {
    marginTop: spacing.sm,
  },
  tileDesc: {
    minHeight: 36,
  },
  progressWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  soon: {
    marginTop: spacing.xl,
  },
  soonCopy: {
    marginTop: spacing.xs,
  },
});
