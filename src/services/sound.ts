/**
 * Sound effects — small, soft cues that make moments feel alive.
 *
 * Synthesised in-house (scripts/make-sounds.py), each under 1.5 s. They:
 *  - follow the phone's silent switch (no sound when it is on),
 *  - mix with whatever else is playing instead of pausing the user's music,
 *  - can be switched off in Profile → Motion & feedback → Sounds.
 * Like haptics, every call is fire-and-forget: audio must never break a log.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/* eslint-disable @typescript-eslint/no-require-imports */
const SOURCES = {
  /** A drink was logged. */
  drop: require('../../assets/sounds/drop.wav'),
  /** A drink was removed. */
  undo: require('../../assets/sounds/undo.wav'),
  /** The mascot was tapped. */
  pop: require('../../assets/sounds/pop.wav'),
  /** 25 / 50 / 75 % reached. */
  chime: require('../../assets/sounds/chime.wav'),
  /** A badge or streak milestone. */
  twinkle: require('../../assets/sounds/twinkle.wav'),
  /** The daily goal is complete. */
  celebrate: require('../../assets/sounds/celebrate.wav'),
  /** A sheet slides in. */
  swish: require('../../assets/sounds/swish.wav'),
} as const;
/* eslint-enable @typescript-eslint/no-require-imports */

export type Sfx = keyof typeof SOURCES;

/** Per-sound loudness, so the frequent ones stay quiet and the rare ones can shine. */
const VOLUME: Record<Sfx, number> = {
  drop: 0.7,
  undo: 0.5,
  pop: 0.6,
  chime: 0.7,
  twinkle: 0.8,
  celebrate: 0.9,
  swish: 0.45,
};

let enabled = true;
let configured = false;
const players: Partial<Record<Sfx, AudioPlayer>> = {};

/** Mirrors `AppSettings.soundsEnabled` so call sites stay one-liners. */
export function setSoundsEnabled(next: boolean): void {
  enabled = next;
}

function configure() {
  if (configured) return;
  configured = true;
  void setAudioModeAsync({
    playsInSilentMode: false,
    interruptionMode: 'mixWithOthers',
    shouldPlayInBackground: false,
  }).catch(() => {});
}

function player(name: Sfx): AudioPlayer {
  let p = players[name];
  if (!p) {
    p = createAudioPlayer(SOURCES[name]);
    players[name] = p;
  }
  return p;
}

/** Load the players up front so the first tap is not delayed. */
export function preloadSounds(): void {
  try {
    configure();
    (Object.keys(SOURCES) as Sfx[]).forEach(player);
  } catch {
    /* Audio unavailable — the app works the same without it. */
  }
}

export function play(name: Sfx): void {
  if (!enabled) return;
  try {
    configure();
    const p = player(name);
    p.volume = VOLUME[name];
    void p
      .seekTo(0)
      .catch(() => {})
      .finally(() => p.play());
  } catch {
    /* Sound is decoration; never surface a failure. */
  }
}
