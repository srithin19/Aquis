/**
 * Mascot state selection and voice — Product Bible 07.
 *
 * The triggers live here, away from the drawing, so Home does not hand-roll
 * "which face now?" logic and so the rules can be tested on their own.
 *
 * Copy follows 07/10: friendly, encouraging, slightly playful — never
 * guilt-driven, never implying danger.
 */

import type { MascotState, TapReaction } from '@/components/Mascot';

/** Long gap before an eligible reminder -> `thirsty` (07). */
export const THIRSTY_AFTER_MS = 3 * 60 * 60 * 1000;

/** A reaction the screen plays right after a log. */
export type Reaction = 'drink' | 'happy' | null;

export interface MascotContext {
  goalReached: boolean;
  /** True for the few seconds of the goal-complete celebration (06.11). */
  celebrating?: boolean;
  /** The post-log reaction currently playing, if any. */
  reaction?: Reaction;
  /** Today's ratio in [0, 1]. */
  progress?: number;
  /** Epoch ms of the most recent entry today, if any. */
  lastEntryAt?: number | null;
  /** True once a goal period has ended without the target being met (11). */
  goalPeriodMissed?: boolean;
  now?: number;
  hour?: number;
}

export function selectMascotState(context: MascotContext): MascotState {
  const now = context.now ?? Date.now();
  const hour = context.hour ?? new Date(now).getHours();
  const progress = context.progress ?? 0;

  if (context.goalPeriodMissed) return 'sad';
  if (context.celebrating) return 'celebrating';
  if (context.reaction === 'drink') return 'drink';
  if (context.reaction === 'happy') return progress >= 0.75 && !context.goalReached ? 'excited' : 'happy';
  // After the party: calm, content pride for the rest of the day.
  if (context.goalReached) return 'proud';

  // Optional late-night state. Deliberately checked before `thirsty` so the app
  // does not nag with a thirsty face at 2am.
  if (hour >= 23 || hour < 5) return 'sleepy';

  if (context.lastEntryAt && now - context.lastEntryAt > THIRSTY_AFTER_MS) return 'thirsty';
  if (!context.lastEntryAt && hour >= 11) return 'thirsty';

  return 'idle';
}

/** Progress marks worth a little shout-out (06.9 "tiny details"). */
export const MILESTONES = [0.25, 0.5, 0.75] as const;

/** The milestone crossed going from `before` to `after`, if any. */
export function crossedMilestone(before: number, after: number): number | null {
  for (let i = MILESTONES.length - 1; i >= 0; i -= 1) {
    const mark = MILESTONES[i];
    if (before < mark && after >= mark) return mark;
  }
  return null;
}

export function milestoneLine(mark: number): string {
  if (mark >= 0.75) return 'Three quarters! Almost there 🔥';
  if (mark >= 0.5) return 'Halfway there! 🌊';
  return 'A quarter done — nice start 💧';
}

const TAP_LINES: Record<TapReaction, readonly string[]> = {
  giggle: ['Hehe, that tickles! 😆', 'Stop it, I’m ticklish!', 'Hahaha! Again!'],
  wink: ['😉 Looking good today', 'Psst… you’re doing great', 'Just between us: you rock'],
  surprised: ['Oh! You startled me 😮', 'Whoa, hi there!', 'Eep! A poke!'],
  love: ['Aww, love you too 💙', 'You make me feel so full ✨', 'Best hydration buddy ever'],
};

/** Taps cycle through the four reactions, so rotate each one's wording every full cycle. */
const TAP_LINES_CYCLE = 4;

/** What the mascot says right after being tapped. */
export function tapLine(reaction: TapReaction, seed: number): string {
  return pick(TAP_LINES[reaction], Math.floor(seed / TAP_LINES_CYCLE));
}

export interface LineContext {
  state: MascotState;
  progress: number;
  remainingLabel: string;
  entryCount: number;
  hour: number;
  /** Rotates through the options when the mascot is tapped. */
  seed: number;
}

function pick(options: readonly string[], seed: number): string {
  return options[((seed % options.length) + options.length) % options.length];
}

/** What the mascot says in its speech bubble on Home. */
export function mascotLine(ctx: LineContext): string {
  const { state, progress, remainingLabel, entryCount, hour, seed } = ctx;
  switch (state) {
    case 'celebrating':
      return pick(['Goal smashed! 🎉', 'We did it! I’m full! 💦', 'Hydration hero 💪'], seed);
    case 'proud':
      return pick(['Goal done for today ✨', 'Feeling full and fabulous', 'Extra sips are a bonus!', 'See you tomorrow, champ'], seed);
    case 'sleepy':
      return pick(['Zzz… see you in the morning', 'Sleepy drop… 😴', 'Rest well, we’ll sip tomorrow'], seed);
    case 'thirsty':
      return pick(['I’m getting a bit dry…', 'A sip would be lovely 🥺', 'Psst… water?', 'Feeling a little parched'], seed);
    case 'drink':
      return pick(['Glug glug 💧', 'Mmm, refreshing!', 'Ahh, that hits the spot'], seed);
    case 'excited':
      return pick(['So close! One more? 🔥', `Only ${remainingLabel} left!`, 'We’re nearly there!'], seed);
    case 'happy':
      if (progress < 0.25) return pick(['Great start! 💧', 'Ooh, refreshing!', 'Yay, water!'], seed);
      if (progress < 0.5) return pick(['Nice sip!', 'Keep it flowing 🌊', 'Loving this'], seed);
      return pick(['Over halfway! 🌊', 'You’re on a roll!', 'Look at me fill up!'], seed);
    case 'sad':
      return pick(['We’ll get it next time 💙', 'A fresh start is waiting'], seed);
    default:
      if (entryCount === 0) {
        return hour < 12
          ? pick(['Good morning! First glass? ☀️', 'Fresh day, fresh glass', 'Rise and hydrate ☀️'], seed)
          : pick(['Let’s get the first sip in', 'Tap a glass to start the day', 'I’m ready when you are!'], seed);
      }
      return pick([`${remainingLabel} to go — you’ve got this`, 'Keep it flowing 🌊', 'Tap me, I’m ticklish 😄', 'Sip, sip, hooray!'], seed);
  }
}
