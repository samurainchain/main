# Synthesized sound effects from a cue list: python sfx2.py cues.json out.wav duration
import json, sys, wave
import numpy as np
SR = 48000
cues, out_path, DUR = json.load(open(sys.argv[1])), sys.argv[2], float(sys.argv[3])
out = np.zeros(int(SR * DUR)); rng = np.random.default_rng(11)

def add(sig, at, gain):
    i = max(0, int(at * SR)); j = min(len(out), i + len(sig))
    if j > i: out[i:j] += sig[:j - i] * gain

def lowpass(x, a):
    y = np.empty_like(x); acc = 0.0
    for k in range(len(x)): acc += a[k] * (x[k] - acc); y[k] = acc
    return y

def whoosh(d, rise=.6):
    n = int(d * SR); t = np.linspace(0, 1, n)
    env = np.where(t < rise, (t / rise) ** 2, ((1 - t) / (1 - rise)) ** 1.5)
    s = lowpass(rng.standard_normal(n), 0.01 + 0.12 * np.sin(np.pi * t) ** 2); s -= lowpass(s, np.full(n, .004))
    return s / (np.abs(s).max() + 1e-9) * env

def impact(d=.6, f0=70):
    n = int(d * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (f0 * t + 30 * (1 - np.exp(-t * 18)) / 18)) * np.exp(-t * 7) * .9 + lowpass(rng.standard_normal(n), np.full(n, .3)) * np.exp(-t * 60) * .5

def pop(f=900, d=.14):
    n = int(d * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t * (1 - t * 2)) * np.exp(-t * 40)

def click(f=2400):
    n = int(.05 * SR); t = np.arange(n) / SR
    return (rng.standard_normal(n) * np.exp(-t * 300) + np.sin(2 * np.pi * f * t) * np.exp(-t * 120)) * .8

def thud():
    a = impact(.35, 55) * .8; b = pop(180, .2) * .4; m = np.zeros(max(len(a), len(b))); m[:len(a)] += a; m[:len(b)] += b; return m

for c in cues:
    k = c[0]
    if k == 'whoosh': add(whoosh(c[2]), c[1], c[3])
    elif k == 'impact': add(impact(.6, c[3]), c[1], c[2])
    elif k == 'pop': add(pop(c[3]), c[1], c[2])
    elif k == 'thud': add(thud(), c[1], c[2])
    elif k == 'click': add(click(), c[1], c[2])
    elif k == 'tick':  # stopwatch ticks across a span
        for j in range(int(c[2] / .12)): add(click(3200) * .5, c[1] + j * .12, .25)
    elif k == 'flaps':  # split-flap rattle
        for j in range(int(c[2] / .045)): add(click(1500 + (j % 5) * 300) * .6, c[1] + j * .045 + rng.uniform(0, .01), .22)
    elif k == 'typing':
        for j in range(int(c[3])): add(click(1800 + (j % 3) * 400), c[1] + j * c[2], .35)
    elif k == 'laser':
        n = int(c[2] * SR); t = np.arange(n) / SR; f = 2600 - 2000 * t / c[2]
        add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3) * .6, c[1], .4); add(whoosh(c[2], .2) * .4, c[1], .4)
    elif k == 'rise':
        n = int(c[2] * SR); t = np.arange(n) / SR; f = 120 + 500 * (t / c[2]) ** 2
        add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t * 6) * .5, c[1], c[3]); add(whoosh(c[2], .9) * .4, c[1], c[3])
    elif k == 'stamp': add(impact(.4, 90), c[1], c[2]); add(click(900), c[1], c[2] * .8)
    elif k == 'ping':
        n = int(.5 * SR); t = np.arange(n) / SR
        add((np.sin(2 * np.pi * 1320 * t) + .5 * np.sin(2 * np.pi * 1980 * t)) * np.exp(-t * 9), c[1], c[2])
    elif k == 'deal': add(whoosh(.22, .3), c[1], c[2]); add(click(1200) * .5, c[1] + .2, c[2])
    elif k == 'clunk': add(impact(.3, 110), c[1], c[2]); add(click(700), c[1], c[2] * .6)
out = np.tanh(out * 1.2) * .8
pcm = (np.stack([out, out], 1) * 32767).astype(np.int16)
w = wave.open(out_path, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
