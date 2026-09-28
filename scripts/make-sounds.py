"""
Synthesises AQUIS's sound effects into assets/sounds/*.wav.

Every sound is built from sine tones, envelopes and filtered noise — no
samples, no licences. Kept short, soft and high-ish so they feel light and
never startle. Re-run after tweaking:  python3 scripts/make-sounds.py
"""

import math
import os
import random
import struct
import wave

RATE = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
random.seed(7)


def silence(seconds):
    return [0.0] * int(RATE * seconds)


def mix(*tracks):
    length = max(len(t) for t in tracks)
    out = [0.0] * length
    for t in tracks:
        for i, v in enumerate(t):
            out[i] += v
    return out


def offset(track, seconds):
    return silence(seconds) + track


def sweep(f0, f1, seconds, amp=0.5, attack=0.004, decay=None, curve=1.0):
    """A sine whose pitch glides from f0 to f1 (exponentially), with an envelope."""
    n = int(RATE * seconds)
    out, phase = [], 0.0
    decay = decay or seconds
    for i in range(n):
        t = i / RATE
        p = (t / seconds) ** curve
        f = f0 * (f1 / f0) ** p
        phase += 2 * math.pi * f / RATE
        env = min(t / attack, 1.0) * math.exp(-t / (decay / 4))
        out.append(amp * env * math.sin(phase))
    return out


def bell(freq, seconds, amp=0.35, decay=0.35):
    """A soft bell: fundamental plus a quiet inharmonic partial, exponential decay."""
    n = int(RATE * seconds)
    out = []
    for i in range(n):
        t = i / RATE
        env = min(t / 0.003, 1.0) * math.exp(-t / decay)
        v = math.sin(2 * math.pi * freq * t) + 0.25 * math.sin(2 * math.pi * freq * 2.76 * t) * math.exp(-t / (decay / 3))
        out.append(amp * env * v / 1.25)
    return out


def noise_swish(seconds, amp=0.25, lo=600, hi=5000):
    """Noise through a one-pole low-pass whose cutoff sweeps up then down."""
    n = int(RATE * seconds)
    out, y = [], 0.0
    for i in range(n):
        p = i / n
        cutoff = lo + (hi - lo) * math.sin(math.pi * p)
        a = 1 - math.exp(-2 * math.pi * cutoff / RATE)
        y += a * (random.uniform(-1, 1) - y)
        env = math.sin(math.pi * p) ** 2
        out.append(amp * env * y)
    return out


def normalise(track, peak):
    m = max(abs(v) for v in track) or 1.0
    # Tiny fade-out so nothing clicks at the end.
    fade = int(RATE * 0.01)
    out = [v * peak / m for v in track]
    for i in range(min(fade, len(out))):
        out[-1 - i] *= i / fade
    return out


def save(name, track, peak=0.5):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with wave.open(path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        data = normalise(track, peak)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in data))
    print(f'{name}: {len(track) / RATE:.2f}s')


# Logging a drink: a water "bloop" — a rising pitch glide, then a smaller bubble.
save('drop.wav', mix(
    sweep(320, 880, 0.16, amp=0.6, curve=0.6),
    offset(sweep(700, 1500, 0.09, amp=0.25, curve=0.7), 0.075),
), peak=0.55)

# Removing a drink: the same bloop, falling — "taken back".
save('undo.wav', sweep(760, 300, 0.16, amp=0.5, curve=0.8), peak=0.4)

# Tapping the mascot: a soft, round pop.
save('pop.wav', mix(
    sweep(520, 240, 0.07, amp=0.6, curve=0.5),
    [0.15 * random.uniform(-1, 1) * math.exp(-i / 40) for i in range(300)],
), peak=0.45)

# 25/50/75%: a light two-note chime.
save('chime.wav', mix(bell(1046.5, 0.5), offset(bell(1568.0, 0.6), 0.09)), peak=0.4)

# Badge unlocked: a twinkly rising arpeggio (E major).
save('twinkle.wav', mix(*[
    offset(bell(f, 0.7, decay=0.28), i * 0.075)
    for i, f in enumerate([1318.5, 1661.2, 1975.5, 2637.0])
]), peak=0.42)

# Goal complete: a warm arpeggiated chord with a sparkle and a swish on top.
save('celebrate.wav', mix(
    *[offset(bell(f, 1.2, amp=0.35, decay=0.45), i * 0.07) for i, f in enumerate([523.25, 659.25, 783.99, 1046.5])],
    *[offset(bell(f, 0.6, amp=0.18, decay=0.2), 0.32 + i * 0.06) for i, f in enumerate([2093.0, 2637.0, 3136.0])],
    noise_swish(0.45, amp=0.12),
), peak=0.5)

# Sheets sliding in: a quiet swish.
save('swish.wav', noise_swish(0.26, amp=0.3, lo=400, hi=3500), peak=0.28)

# Notification sound (used in real app builds; Expo Go plays the system sound).
save('aquis_drop.wav', mix(
    sweep(360, 900, 0.18, amp=0.6, curve=0.6),
    offset(sweep(750, 1600, 0.1, amp=0.25, curve=0.7), 0.09),
    offset(bell(1318.5, 0.5, amp=0.2, decay=0.25), 0.16),
), peak=0.6)
