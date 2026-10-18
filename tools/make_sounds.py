"""Generates the placeholder sound effects and music loop in assets/audio/ (16-bit mono WAV, 22050 Hz).

Replace any file with your own sound of the same name; nothing else needs to change.
Run: python3 tools/make_sounds.py
"""
import math, random, struct, wave, os

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audio')
random.seed(7)


def write(name, samples, vol=0.6):
    peak = max(1e-9, max(abs(s) for s in samples))
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s / peak * vol)) * 32767)) for s in samples))


def sq(ph):
    return 1.0 if (ph % 1.0) < 0.5 else -1.0


def tone(f0, f1, dur, wave_fn=sq, decay=6.0, noise=0.0):
    out, ph = [], 0.0
    n = int(dur * RATE)
    for i in range(n):
        t = i / n
        f = f0 + (f1 - f0) * t
        ph += f / RATE
        env = math.exp(-decay * t) * min(1.0, i / 60)
        out.append((wave_fn(ph) * (1 - noise) + (random.random() * 2 - 1) * noise) * env)
    return out


tri = lambda ph: 4 * abs((ph % 1.0) - 0.5) - 1
write('jump.wav', tone(380, 760, 0.12, sq, 5), 0.35)
write('walljump.wav', tone(300, 900, 0.14, sq, 5), 0.35)
write('dash.wav', tone(900, 180, 0.18, sq, 4, noise=0.55), 0.45)
write('death.wav', tone(420, 50, 0.45, sq, 3, noise=0.35), 0.5)
write('land.wav', tone(160, 90, 0.06, tri, 9, noise=0.4), 0.25)
write('orb.wav', tone(880, 1320, 0.16, tri, 4) , 0.4)
write('crystal.wav', tone(1046, 1568, 0.1, tri, 3) + tone(1568, 2093, 0.14, tri, 4), 0.4)
write('key.wav', tone(988, 988, 0.07, sq, 2) + tone(1319, 1319, 0.16, sq, 4), 0.3)
write('unlock.wav', tone(523, 523, 0.08, sq, 2) + tone(659, 659, 0.08, sq, 2) + tone(784, 784, 0.18, sq, 4), 0.3)
write('switch.wav', tone(220, 440, 0.07, sq, 3, noise=0.2), 0.3)
write('pad.wav', tone(200, 1200, 0.2, tri, 3), 0.45)
write('portal.wav', tone(600, 300, 0.25, tri, 2), 0.35)
write('room.wav', tone(660, 990, 0.12, tri, 3), 0.25)
write('goal.wav', sum((tone(f, f, 0.12, sq, 2) for f in (523, 659, 784, 1046)), []) + tone(1046, 1046, 0.4, tri, 3), 0.35)

# 8-bar minor loop (A minor, 128 bpm): bass, arpeggio, hats.
BPM = 128
step = 60 / BPM / 4
chords = [(57, 60, 64), (53, 57, 60), (48, 52, 55), (55, 59, 62)]
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
n = int(step * 16 * 8 * RATE)
music = [0.0] * n
def add(start, samples, gain):
    s = int(start * RATE)
    for i, v in enumerate(samples):
        if s + i < n:
            music[s + i] += v * gain
for bar in range(8):
    root, third, fifth = chords[(bar // 2) % 4]
    for k in range(16):
        t = (bar * 16 + k) * step
        if k % 4 == 0:
            add(t, tone(hz(root - 12), hz(root - 12), step * 3, tri, 2), 0.5)
        arp = [root, third, fifth, third + 12][k % 4] + (12 if bar % 4 == 3 and k >= 8 else 0)
        add(t, tone(hz(arp + 12), hz(arp + 12), step * 0.9, sq, 6), 0.12)
        if k % 2 == 1:
            add(t, tone(8000, 8000, 0.03, sq, 12, noise=1.0), 0.08)
write('music.wav', music, 0.5)
print('ok')
