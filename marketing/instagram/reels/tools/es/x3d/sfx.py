import numpy as np, wave
SR = 48000; DUR = 32.5
out = np.zeros(int(SR * DUR))
rng = np.random.default_rng(7)

def add(sig, at, gain):
    i = int(at * SR); j = min(len(out), i + len(sig)); out[i:j] += sig[:j - i] * gain

def lowpass(x, a):  # one-pole
    y = np.empty_like(x); acc = 0.0
    for k in range(len(x)): acc += a[k] * (x[k] - acc); y[k] = acc
    return y

def whoosh(d, rise=.6):
    n = int(d * SR); t = np.linspace(0, 1, n)
    env = np.where(t < rise, (t / rise) ** 2, ((1 - t) / (1 - rise)) ** 1.5)
    cut = 0.01 + 0.12 * np.sin(np.pi * t) ** 2
    s = lowpass(rng.standard_normal(n), cut); s -= lowpass(s, np.full(n, .004))
    return s / (np.abs(s).max() + 1e-9) * env

def impact(d=.6, f0=70):
    n = int(d * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (f0 * t + 30 * (1 - np.exp(-t * 18)) / 18)) * np.exp(-t * 7)
    click = lowpass(rng.standard_normal(n), np.full(n, .3)) * np.exp(-t * 60)
    return body * .9 + click * .5

def pop(f=900, d=.12):
    n = int(d * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t * (1 - t * 2)) * np.exp(-t * 40)

def clickfx():
    n = int(.05 * SR); t = np.arange(n) / SR
    return (rng.standard_normal(n) * np.exp(-t * 300) + np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 120)) * .8

add(impact(), 2.28, .55); add(impact(f0=90), 5.38, .5)
add(whoosh(.7), 4.05, .35)
add(whoosh(1.0, .7), 6.6, .5); add(impact(.4, 55), 7.33, .25)
for at in (10.0, 14.05, 17.5): add(pop(520, .18), at, .3); add(whoosh(.35, .5), at - .25, .18)
add(whoosh(.9, .5), 20.15, .45)
add(impact(.5, 80), 20.95, .3); add(impact(.5, 65), 21.9, .3)
add(whoosh(.8, .55), 24.35, .4)
add(clickfx(), 26.74, .5)
add(pop(1100), 27.45, .25); add(pop(820), 27.8, .25)
add(whoosh(.7, .75), 28.75, .5); add(impact(.7, 60), 29.2, .3)
out = np.tanh(out * 1.2) * .8
pcm = (np.stack([out, out], 1) * 32767).astype(np.int16)
w = wave.open('x3d/sfx.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
print('ok')
