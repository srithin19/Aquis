# AQUIS

A mascot-driven hydration companion. Expo + React Native + TypeScript, local-first.

> Set a goal → receive a considerate reminder → log water → watch the droplet fill → see the mascot react.

All five phases of the Product Bible development plan (section 20) are implemented: foundation,
core hydration, the notification engine, history & motivation, and the polish pass. The look is a
Matiks-style dark theme — flat charcoal grounds, neon lime actions, lavender / teal / yellow 3D tiles.

## Running it

```bash
npm install        # .npmrc sets legacy-peer-deps; a react-dom peer conflict inside expo-router otherwise fails the install
npm start          # then scan the QR code with Expo Go
```

Everything runs in **Expo Go** — Skia, gradients, blur, fonts and *local* notifications are all
supported there. No development build is needed.

**The first bundle takes 45–60 seconds.** Expo Go will show *"Failed to download remote update"* if
you scan the QR before Metro has finished that cold build — it is a timeout, not a failure. Wait for
Metro to print `Android Bundled …` before scanning. Once the cache is warm the same bundle serves in
about 200 ms, and only changed modules rebuild.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run android` / `npm run ios` | Start with a platform preselected |
| `npm test` | 66 Jest tests: every screen and button, end-to-end data flows on a real SQLite (sql.js), sounds, and one regression test per audited bug |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run sounds` | Re-synthesise the sound effects in `assets/sounds/` |
| `npm run check:domain` | 39 domain checks: hydration maths, goal periods, local dates, streaks, badges, reminder planning, calendar grid |

### If Expo Go will not connect

1. **Wait for the cold build.** See above — this is the usual cause.
2. **Skip the QR.** In Expo Go, tap *Enter URL manually* and type `exp://<your-lan-ip>:8081`. This
   rules out anything QR- or deep-link-related.
3. **Check the phone can reach the machine.** Open `http://<your-lan-ip>:8081` in the phone's
   browser. If it times out, the phone is on a different network or the router is isolating clients;
   if it loads, the network is fine and the problem is Expo Go itself (usually a version that
   predates this SDK).
4. **Last resort:** `npx expo start --tunnel` works regardless of network topology, at the cost of
   routing dev traffic through a third-party relay.

> Building from a OneDrive-synced folder makes Metro noticeably slower and can cause flaky file
> watching. Moving the project to a plain local path is worth it if builds feel slow.

## What is implemented

**Look & motion**

- Matiks-style dark palette ([`src/theme/tokens.ts`](src/theme/tokens.ts)), sampled from Matiks'
  own screenshots: `#141414` grounds, `#1C1C1C` cards, neon lime `#B2F966`, lavender `#B3A3FB`,
  pastel pink/yellow, teal water. Chunky 3D buttons and tiles that press into their edge.
- A dark React Navigation theme, so no screen, modal or transition can fall back to light grey.
- One easing curve (`ease.out`, no overshoot) and short durations everywhere: screens crossfade in
  180 ms, sheets in 260 ms, tabs in 140 ms.
- The mascot ([`Mascot`](src/components/Mascot.tsx)) is a character, rendered in **Skia** on the UI
  thread. Ten feelings — idle, happy, drink, thinking, thirsty, excited, celebrating, proud, sleepy,
  sad — are each a *pose* (eyes, mouth, brows, cheeks, effects) that the face morphs between
  smoothly, plus body language per feeling: happy hops, excited bounces, celebrating leaps with a
  spin, thirsty shivers, sad sulks, sleepy dozes. Effects: tears, sweat, drifting z's, twinkling
  stars, floating hearts, thought dots, a lime glow. It blinks and giggles when tapped. No limbs — it stays a pure droplet.
  The liquid inside is two sine waves under a gradient with rising bubbles and a slosh on every
  change; the face is drawn twice and clipped at the waterline so it reads at every level.
- Home: the mascot talks in a speech bubble (tap it for another line), reacts to every drink from
  any source (gulp → grin), shouts out 25/50/75%, and throws a party at 100% — confetti, a burst,
  a GOAL COMPLETE banner, a flare on the halo — before settling into calm pride. "Last sip 12 min
  ago", a streak chip that pops when it grows, and "New day, fresh glass" at midnight.
- Home: sweep-gradient progress halo ([`ProgressRing`](src/components/ProgressRing.tsx)), a ripple and
  a floating “+250 ml” on each log, count-up numbers, spring-loaded gradient quick-add tiles, and
  timeline rows that animate in, out and re-flow (Reanimated 4 layout animations).
- Floating tab bar with a gliding lime indicator.
- Badge-reveal sheet: backdrop fade → sheet glide → one glow bloom → badge settles → copy rises.
  Badge checks run one at a time, so a badge can never be celebrated twice.
- Reduce Motion (OS setting or in-app toggle) turns waves, loops and large movement into instant
  state changes everywhere.

**Phase 1–2 — Foundation & core hydration**

- SQLite with versioned, append-only migrations; repositories are the only layer that writes SQL.
- Onboarding + auth shell, goal + duration, one active goal enforced in a transaction.
- Quick-add (configurable) and custom amounts; a minus on every entry; derived daily totals.

**Phase 3 — Notification engine** ([`domain/notifications.ts`](src/domain/notifications.ts),
[`services/notificationService.ts`](src/services/notificationService.ts))

- OS permission requested only on the reminders screen, after the explanation (06.6).
- Randomized opportunity windows 2.5–3.25 h after the last drink (first one of the day 45–90 min
  after waking); never within 90 min of a drink.
- Suppression: goal complete (unless post-goal reminders are on), quiet hours (editable in Profile,
  may wrap midnight), daily cap of 6, and silence while AQUIS itself is open.
- The whole plan is rebuilt on every log, removal, settings change and foreground, and only future
  times are ever scheduled — so there is never a backlog or a burst after suppression.
- Each reminder says where the day stands — e.g. *“1.2 L of 2.5 L (48%) · 1.3 L to go”* — and on
  iOS carries a picture of the mascot droplet filled to that level, drawn offscreen with Skia
  ([`notificationArt.ts`](src/services/notificationArt.ts)). Android shows the text (expo-notifications
  has no image support there).
- Tapping a reminder opens Home; its **Log 250 ml** action logs straight from the notification.
- Every planned reminder is recorded in `notification_event` (scheduled / shown / opened / logged).

**Phase 4 — History & motivation**

- Month calendar of droplets that fill to each day's frozen completion on first render; month
  selector; weekly and monthly summary; last-7-days bar chart.
- Day detail sheet: goal that applied that day, totals, sequential entry timeline.
- Streaks (current / longest, from daily records only) with milestone celebrations.
- Achievement engine for the seven badges in section 12, with live progress and a badge-reveal sheet.
- Goal-end flow: when a period elapses it is frozen as `completed` (every day at 100%) or `ended`,
  and a one-time summary screen shows the result — celebrating or gently sad, never scolding.

**Sound**

- Original, synthesised effects ([`scripts/make-sounds.py`](scripts/make-sounds.py)): a water bloop
  on logging, an undo blip, a pop when the mascot is tapped, a chime at 25/50/75%, a twinkle for
  badges, a celebration at 100%, a swish for sheets. They follow the silent switch, mix with the
  user's music, and can be switched off in Profile → Sounds.
- Reminders play a sound when Sounds is on: the system sound in Expo Go, the AQUIS drop
  (`aquis_drop.wav`, bundled by the expo-notifications plugin) in a real build. On Android a silent
  channel is used when Sounds is off.

**Phase 5 — Polish**

- Haptics (light on logging, success on milestones), empty/blocked/no-goal states, midnight
  rollover while the app stays open, and a local-only analytics event taxonomy (section 14) that
  never leaves the device.

## Screens

| Route | Product Bible |
| --- | --- |
| [`app/index.tsx`](app/index.tsx) | 06.1 Splash |
| [`app/(onboarding)/welcome.tsx`](app/(onboarding)/welcome.tsx) | 06.2 Welcome |
| [`app/(onboarding)/sign-in.tsx`](app/(onboarding)/sign-in.tsx) | 06.3 Authentication |
| [`app/(onboarding)/goal.tsx`](app/(onboarding)/goal.tsx) | 06.4 Goal setup |
| [`app/(onboarding)/duration.tsx`](app/(onboarding)/duration.tsx) | 06.5 Goal duration |
| [`app/(onboarding)/notifications.tsx`](app/(onboarding)/notifications.tsx) | 06.6 Notification setup |
| [`app/(onboarding)/mascot.tsx`](app/(onboarding)/mascot.tsx) | 06.7 Mascot introduction |
| [`app/(onboarding)/confirm.tsx`](app/(onboarding)/confirm.tsx) | 06.8 Goal confirmation |
| [`app/(tabs)/index.tsx`](app/(tabs)/index.tsx) | 06.9 Home, 06.11 Daily complete |
| [`app/custom-amount.tsx`](app/custom-amount.tsx) | 06.10 Custom water entry |
| [`app/(tabs)/history.tsx`](app/(tabs)/history.tsx) | 06.12 History calendar |
| [`app/day/[date].tsx`](app/day/[date].tsx) | 06.13 Day detail |
| [`app/(tabs)/achievements.tsx`](app/(tabs)/achievements.tsx) | 06.14 Achievements |
| [`app/goal-summary.tsx`](app/goal-summary.tsx) | 04 Goal completion summary |
| [`app/(tabs)/profile.tsx`](app/(tabs)/profile.tsx) | 06.15 Profile / Settings |

## Two rules the code is built around

**Derived totals (09).** A day's consumed amount is never stored as an independently editable value.
Every entry insert, undo and delete recomputes the day from `water_entry` inside the same
transaction, so the acceptance criterion *"the visual glass always matches the stored daily total"* —
here, the droplet — holds by construction. This is also what makes the per-entry minus safe:
subtracting any entry, not just the last one, leaves a day that still adds up.

**Historical integrity (11).** `daily_hydration.goal_ml` belongs to the day it was recorded on.
Changing your goal starts a new period, and days already logged keep the target that applied when
they happened. Two rows may still take a stamp: one created before any goal existed, and today's row
when a new period begins today. [`shouldStampGoalOnDay`](src/domain/goals.ts) is that rule, and it is
covered by `npm run check:domain` — getting it wrong froze the whole Home screen at 0%.

Local dates are handled explicitly as `YYYY-MM-DD` keys built from local calendar fields —
`toISOString()` is deliberately never used for a day key, so a drink at 23:30 does not move
to tomorrow. `npm run check:domain` covers this along with DST and month boundaries.

## Known limits

| Area | Note |
| --- | --- |
| Active-call / >1 h screen-use suppression | Not exposed to Expo apps. Per the spec's platform-limitation note, these fall back to time-based rules; the one live signal used is "AQUIS is open right now". |
| Auth | "Continue with Google" and email create a **local** profile — no Google account is contacted and no email is verified. Real Google sign-in needs OAuth client IDs from Google Cloud and a development build (Expo Go can't host it); `authService` is the one place to plug it in. |
| Custom notification sound | Needs a real build; Expo Go plays the system sound instead. |
| Mascot | Skia rather than Rive: Rive needs a development build, and this runs in Expo Go. The state vocabulary is identical, so a Rive swap is a component-level change. |
| Social (V2) | Friends and challenges are out of MVP scope and are only teased on Achievements. |

## Architecture

```
app/                    Expo Router routes
  (onboarding)/         06.2 – 06.8
  (tabs)/               Home · History · Achievements · Profile
src/
  components/           Mascot (Skia gauge), ProgressRing, MiniDroplet, Badge,
                        MomentSheet, Celebration, CountUp, Icon, ui primitives
  db/                   SQLite client + migrations
  domain/               Pure logic: hydration, goals, dates, streaks, achievements, reminder planning
  repositories/         Data access — the only layer that writes SQL
  services/             authService, notificationService (expo-notifications adapter), analytics
  state/                AppProvider, OnboardingProvider
  theme/                Design tokens
  utils/                haptics, reduce-motion, ids
scripts/check-domain.ts Domain-logic checks
```

Data flows one way: UI → `AppProvider` → repositories → SQLite. The provider caches only the slice
every screen needs (profile, settings, active goal, today's hydration); the database stays the single
source of truth.

## Privacy

Everything stays on the device. No backend, no analytics upload, no ads, and no calendar or health
permissions. AQUIS offers general wellness guidance and is not a medical device.
