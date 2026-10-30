# Experimental reel 06: desktop app in 3D space, camera fly-through, pop-out rows,
# extruded numbers, cursor clicks. Same voiceover and subtitles as the flat version.
# Run from scratchpad/es:  python3 x3d/build3d.py
import json, sys
sys.argv = sys.argv[:1]
import build  # noqa: E402  (reads base.css, words-06.json from the cwd)

r = build.Reel('06'); T = r.T
SUB = json.dumps(build.chunks(r.toks), ensure_ascii=False)
W = {k: T(k) for k in ['costó', 'con calma', 'ganaste', 'es un', 'cuatro', 'tres', '16', 'mismo', 'misma', 'la diferencia', 'marca', 'antes', 'tiltless', 'operar']}
W['costó2'] = T('costó'); W['enojo'] = T('enojo'); W['op2'] = T('operar', 2)
END = r.end() + 0.9

CSS = """
  #cam { position:absolute; inset:0; perspective:1400px; perspective-origin:540px 900px; overflow:hidden }
  .world { position:absolute; left:540px; top:900px; width:0; height:0; transform-style:preserve-3d; transform-origin:0 0 }
  .win { position:absolute; left:0; top:0; width:1440px; height:944px; border-radius:22px; overflow:hidden; background:#121212;
    border:2px solid #ffffff1f; box-shadow:0 60px 160px -20px #000, 0 0 120px -30px #3ecf8e66 }
  .chrome { height:44px; background:#1b1b1b; border-bottom:1px solid #2e2e2e; display:flex; align-items:center; gap:10px; padding:0 18px }
  .chrome i { width:14px; height:14px; border-radius:50%; background:#3a3a3a; display:block }
  .chrome .url { margin-left:24px; flex:0 0 520px; height:28px; border-radius:8px; background:#121212; color:#a0a0a0; font:500 16px 'JetBrains Mono', monospace; display:flex; align-items:center; padding-left:14px }
  .chrome .url b { color:#3ecf8e; font-weight:500 }
  .view { position:absolute; left:0; top:44px; width:1440px; height:900px; overflow:hidden }
  .view img { position:absolute; left:0; top:0; width:1440px }
  .sweep { position:absolute; inset:-200px; background:linear-gradient(105deg, transparent 40%, #ffffff16 48%, #3ecf8e22 50%, transparent 58%); opacity:0 }
  .pop { position:absolute; border-radius:14px; background-repeat:no-repeat; border:2px solid #2e2e2e; box-shadow:0 30px 80px -10px #000; opacity:0 }
  .pop.r { border-color:#f2555a; box-shadow:0 30px 80px -10px #000, 0 0 50px #f2555a88 }
  .pop.g { border-color:#3ecf8e; box-shadow:0 30px 80px -10px #000, 0 0 50px #3ecf8e88 }
  .tag3d { position:absolute; padding:18px 30px; border-radius:22px; font:700 54px 'JetBrains Mono', monospace; white-space:nowrap; background:#121212ee; opacity:0 }
  .tag3d.r { color:#f2555a; border:3px solid #f2555a; box-shadow:0 0 60px #f2555a77, 0 40px 80px -10px #000 }
  .tag3d.g { color:#3ecf8e; border:3px solid #3ecf8e; box-shadow:0 0 60px #3ecf8e77, 0 40px 80px -10px #000 }
  .tag3d span { font:600 40px Inter, sans-serif; color:#ededed; margin-right:22px }
  #floor { position:absolute; left:-1500px; top:1250px; width:4080px; height:3000px; transform-origin:50% 0; transform:rotateX(80deg);
    background-image:linear-gradient(#3ecf8e30 2px, transparent 2px), linear-gradient(90deg, #3ecf8e30 2px, transparent 2px); background-size:120px 120px;
    -webkit-mask-image:radial-gradient(closest-side at 50% 15%, #000, transparent); opacity:.0 }
  #floorcam { position:absolute; inset:0; perspective:900px; perspective-origin:540px 700px; overflow:hidden }
  /* Hook cube */
  #hookcam { position:absolute; inset:0; perspective:1600px; perspective-origin:540px 760px }
  #cube { position:absolute; left:90px; top:300px; width:900px; height:860px; transform-style:preserve-3d }
  .face { position:absolute; inset:0; text-align:center; backface-visibility:hidden; transform-style:preserve-3d; font-size:128px }
  .face * { backface-visibility:hidden }
  .face .w { display:inline-block; font-size:128px; font-weight:800; letter-spacing:-.035em; line-height:1.04 }
  .face .num { display:block; margin-top:60px; font:700 280px 'JetBrains Mono', monospace; letter-spacing:-.06em; position:relative; line-height:1.1 }
  .num .c1, .num .c2 { position:absolute; inset:0; mix-blend-mode:screen; opacity:0 }
  .num .c1 { color:#00e5ff } .num .c2 { color:#ff2bd6 }
  .ext { position:absolute; left:0; width:1080px; text-align:center; transform-style:preserve-3d }
  .ext div { position:absolute; left:0; right:0; font:800 210px 'JetBrains Mono', monospace; letter-spacing:-.06em }
  .ext .lbl { font:700 54px Inter, sans-serif; letter-spacing:-.01em; color:#ededed; top:-80px }
  .cursor { position:absolute; width:56px; height:56px; opacity:0; filter:drop-shadow(0 6px 10px #000a) }
  .ripple { position:absolute; width:140px; height:140px; margin:-70px 0 0 -70px; border-radius:50%; border:5px solid #3ecf8e; opacity:0 }
  #flash { position:absolute; inset:0; background:#fff; opacity:0; pointer-events:none }
"""

def ext(id, text, color, top, label):
    layers = ''.join(f'<div style="transform:translateZ({-k * 5}px);color:{shade(color, k)}">{text}</div>' for k in range(16, 0, -1))
    return f'<div class="ext" id="{id}" style="top:{top}px;opacity:0">{layers}<div style="color:{color};text-shadow:0 0 50px {color}88">{text}</div><div class="lbl">{label}</div></div>'

def shade(hex_, k):
    h = hex_.lstrip('#'); rgb = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    f = 0.55 - k * 0.025
    return '#' + ''.join(f'{max(0, int(c * f)):02x}' for c in rgb)

def row(id, cls, x, y, w, h, scroll_hint=0):
    pad = 10
    return (f'<div class="pop {cls}" id="{id}" style="left:{x - pad}px;top:{y - pad}px;width:{w + 2 * pad}px;height:{h + 2 * pad}px;'
            f'background-image:url(x3d/shots/analytics-full.png);background-size:1440px auto;background-position:{-(x - pad)}px {-(y - pad)}px;background-color:#1a1a1a"></div>')

CURSOR = '<svg class="cursor" id="{id}" viewBox="0 0 24 24"><path d="M4 2 L4 20 L9 15 L12.5 22 L15.5 20.5 L12 13.8 L19 13.8 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>'

html = f"""<!doctype html><html><head><meta charset="utf-8"><style>{build.BASE}{build.EXTRA}{CSS}</style></head><body>
<div class="grid"></div>
<div id="floorcam"><div id="floor"></div></div>

<div id="hookcam" class="layer" style="opacity:1"><div id="cube">
  <div class="face" id="f1"><span class="w" id="h1">Operar</span> <span class="w" id="h2">con</span> <span class="w r" id="h3">enojo</span><br><span class="w" id="h4">te costó</span>
    <span class="num r" id="n1">−$680<span class="c1">−$680</span><span class="c2">−$680</span></span></div>
  <div class="face" id="f2"><span class="w">Con</span> <span class="w g">calma</span><br><span class="w">ganaste</span>
    <span class="num g" id="n2">+$885<span class="c1">+$885</span><span class="c2">+$885</span></span></div>
</div></div>

<div id="cam" class="layer">
  <div class="world" id="world">
    <div class="win" id="win"><div class="chrome"><i></i><i></i><i></i><div class="url">tiltless.xyz/<b>#/analytics</b></div></div>
      <div class="view"><img id="page" src="x3d/shots/analytics-full.png"></div><div class="sweep" id="sweep"></div></div>
    {row('pE', 'r', 863, 898, 528, 45)}{row('pF', 'r', 863, 955, 528, 45)}{row('pC', 'g', 863, 1184, 528, 45)}
  </div>
</div>

<div id="mood" class="layer"><div style="position:absolute;inset:0;perspective:1300px;perspective-origin:540px 850px"><div id="moodw" style="position:absolute;inset:0;transform-style:preserve-3d">
  {ext('xg', '+$885', '#3ecf8e', 700, 'Con calma · 16 operaciones')}{ext('xr', '−$680', '#f2555a', 1040, 'Con enojo · 4 operaciones')}
</div></div></div>

<div id="cam2" class="layer" style="perspective:1400px;perspective-origin:540px 900px;overflow:hidden">
  <div class="world" id="world2">
    <div class="win" id="win2"><div class="chrome"><i></i><i></i><i></i><div class="url">tiltless.xyz/<b>#/trades</b></div></div>
      <div class="view"><img id="entry" src="x3d/shots/entry-view.png" style="width:1440px"><img id="entryC" src="x3d/shots/entry-calma.png" style="width:1440px;opacity:0"></div>
      <div class="sweep" id="sweep2"></div><div class="ripple" id="ripple"></div>{CURSOR.format(id='cur')}</div>
    <div class="tag3d g" id="tg" style="left:330px;top:250px"><span>Calma</span>+$885</div>
    <div class="tag3d r" id="tr" style="left:760px;top:700px"><span>Enojo</span>−$680</div>
  </div>
</div>

<div id="heads" class="layer" style="opacity:1"><div class="caption"><div class="label" id="lbl"></div>
  <h1 id="hd0" style="opacity:0">Mes de demostración,<br>un solo trader.</h1>
  <h1 id="hd1" style="opacity:0">Enojo: 4 operaciones.<br><span class="r">−$680.</span></h1>
  <h1 id="hd2" style="opacity:0">FOMO: 3 operaciones.<br><span class="r">−$390.</span></h1>
  <h1 id="hd3" style="opacity:0">Calma: 16 operaciones.<br><span class="g">+$885.</span></h1>
  <h1 id="hd4" style="opacity:0">Mismo mercado.<br>Misma cuenta.</h1>
  <h1 id="hd5" style="opacity:0">La diferencia:<br><span class="g">el estado de ánimo.</span></h1>
  <h1 id="hd6" style="opacity:0">Marca cómo te sientes<br>antes de cada operación.</h1>
  <h1 id="hd7" style="opacity:0">Tiltless te enseña<br><span class="g">la diferencia en dólares.</span></h1>
</div></div>

{build.end_card('Operar con enojo<br><span class="r">tiene precio.</span>', 'El diario es gratis · Pro 30 días gratis')}
<div id="flash"></div>
<div class="sub" id="sub"><span class="box" id="subbox"></span></div>
<script>
{build.JS_HELPERS}
const CHUNKS = {SUB}
const W = {json.dumps(W)}
const lerp = (a, b, p) => a + (b - a) * p
const easeOutExpo = (x) => x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x))
const easeOutBack = (x) => {{ x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }}
// Camera keys: [time, {{x, y, z, rx, ry, rz, scroll}}, easing of the segment that ends at this key]
function track(keys, t) {{
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 0; i < keys.length - 1; i++) {{
    const [a, A] = keys[i], [b, B, e] = keys[i + 1]
    if (t < b) {{ const x = (t - a) / (b - a); const p = e === 'expo' ? easeOutExpo(x) : e === 'lin' ? x : ease(x); const o = {{}}; for (const k in A) o[k] = lerp(A[k], B[k], p); return o }}
  }}
  return keys[keys.length - 1][1]
}}
const camCss = (c) => `translateZ(${{c.z}}px) rotateX(${{c.rx}}deg) rotateY(${{c.ry}}deg) rotateZ(${{c.rz}}deg) translate(${{-c.x}}px, ${{-c.y}}px)`
const shake = (t, at, dur = .35, amp = 18) => {{ const k = clamp(1 - (t - at) / dur); return t < at ? [0, 0] : [Math.sin(t * 91) * amp * k, Math.cos(t * 77) * amp * k] }}
const S0 = 700 // page scroll that brings the emotion widget into the window
const rowY = (y) => 44 + y - S0 + 22
const CAM = [
  [W['es un'] - .2, {{ x: 720, y: 480, z: -2600, rx: 62, ry: 0, rz: -30, scroll: 0 }}],
  [W['es un'] + 1.3, {{ x: 720, y: 470, z: -650, rx: 16, ry: -16, rz: -3, scroll: 0 }}, 'expo'],
  [W['cuatro'] - .2, {{ x: 760, y: 470, z: -560, rx: 12, ry: -12, rz: -2, scroll: 0 }}],
  [W['cuatro'] + .7, {{ x: 1127, y: rowY(898) + 120, z: 320, rx: 10, ry: -20, rz: 0, scroll: S0 }}],
  [W['tres'] - .1, {{ x: 1127, y: rowY(898) + 130, z: 330, rx: 8, ry: -16, rz: 0, scroll: S0 }}],
  [W['tres'] + .5, {{ x: 1127, y: rowY(955) + 130, z: 330, rx: 6, ry: -8, rz: 0, scroll: S0 }}],
  [W['16'] - .1, {{ x: 1127, y: rowY(955) + 140, z: 330, rx: 6, ry: -4, rz: 0, scroll: S0 }}],
  [W['16'] + .6, {{ x: 1150, y: rowY(1184) + 60, z: 320, rx: -4, ry: 8, rz: 1, scroll: S0 }}],
  [W['mismo'] - .3, {{ x: 1150, y: rowY(1184) + 60, z: 350, rx: -5, ry: 11, rz: 1, scroll: S0 }}],
  [W['mismo'] + .4, {{ x: 900, y: 700, z: -2200, rx: 70, ry: 0, rz: 20, scroll: S0 }}],
]
const CAM2 = [
  [W['marca'] - .3, {{ x: 720, y: 472, z: -900, rx: 0, ry: -70, rz: 0 }}],
  [W['marca'] + .5, {{ x: 720, y: 472, z: -560, rx: 6, ry: -10, rz: 0 }}, 'expo'],
  [W['antes'], {{ x: 720, y: 527, z: 120, rx: 8, ry: -6, rz: 0 }}],
  [W['tiltless'] - .1, {{ x: 720, y: 540, z: 200, rx: 10, ry: 4, rz: 0 }}],
  [W['tiltless'] + .6, {{ x: 760, y: 480, z: -250, rx: 14, ry: 14, rz: -2 }}],
  [W['op2'] - .2, {{ x: 760, y: 480, z: -200, rx: 14, ry: 18, rz: -2 }}],
  [W['op2'] + .3, {{ x: 760, y: 480, z: 1500, rx: 0, ry: 0, rz: 0 }}, 'lin'],
]
function heads(t) {{
  const cues = [[W['es un'] - .1, 'hd0'], [W['cuatro'], 'hd1'], [W['tres'], 'hd2'], [W['16'], 'hd3'], [W['mismo'], 'hd4'], [W['la diferencia'], 'hd5'], [W['marca'] - .1, 'hd6'], [W['tiltless'], 'hd7'], [W['op2'] - .1, null]]
  cues.forEach(([a, id], i) => {{ if (!id) return; const b = cues[i + 1][0]; const o = Math.min(clamp((t - a) / .2), clamp((b - t) / .15)); const el = $(id); el.style.opacity = o; el.style.transform = `translateY(${{(1 - clamp((t - a) / .3)) * 30}}px)`; el.style.filter = `blur(${{(1 - clamp((t - a) / .25)) * 8}}px)` }})
  const lab = t < W['mismo'] ? '<b>PnL por emoción</b> · demo · escritorio' : t < W['marca'] ? '<b>Mes de demostración</b> · una cuenta' : '<b>Nueva operación</b> · escritorio'
  $('lbl').innerHTML = lab; $('lbl').style.opacity = t < W['es un'] - .1 || t > W['op2'] - .1 ? 0 : 1
}}
function wordIn(id, t, at) {{ const p = clamp((t - at + .05) / .35), e = easeOutBack(p); const el = $(id); el.style.opacity = clamp(p * 2); el.style.transform = `translateZ(${{(1 - e) * -900}}px)`; el.style.filter = `blur(${{(1 - p) * 14}}px)`; el.style.display = 'inline-block' }}
function slam(id, t, at) {{
  const p = clamp((t - at) / .28), el = $(id)
  el.style.opacity = clamp(p * 3); el.style.transform = `translateZ(${{(1 - easeOutBack(p)) * 1100}}px)`; el.style.filter = `blur(${{(1 - p) * 18}}px)`
  const g = t > at + .22 && t < at + .55 ? 1 : 0, j = Math.sin(t * 140) * 14
  el.querySelector('.c1').style.opacity = g * .9; el.querySelector('.c1').style.transform = `translate(${{-10 + j}}px, 2px)`
  el.querySelector('.c2').style.opacity = g * .9; el.querySelector('.c2').style.transform = `translate(${{10 - j}}px, -2px)`
}}
window.render = (t) => {{
  // Floor grid: rises in during the desktop scene and the mood scene, scrolls toward the viewer.
  const fl = Math.max(Math.min(clamp((t - W['es un']) / .8), clamp((W['marca'] - t) / .4)), 0)
  $('floor').style.opacity = fl * .9; $('floor').style.backgroundPosition = `0 ${{t * 160}}px`

  // 1. Hook: words fly in from depth, the amount slams with a glitch, the cube turns to the calm side.
  if (show('hookcam', t, 0, W['es un'] - .05, .1)) {{
    wordIn('h1', t, 0.55); wordIn('h2', t, 1.05); wordIn('h3', t, 1.2); wordIn('h4', t, 1.6)
    slam('n1', t, W['costó'] + .25); slam('n2', t, W['ganaste'] + .35)
    const turn = prog(t, W['con calma'] - .25, W['con calma'] + .35)
    const [sx, sy] = shake(t, W['costó'] + .5); const [sx2, sy2] = shake(t, W['ganaste'] + .65)
    const out = clamp((t - (W['es un'] - .45)) / .4)
    $('cube').style.transform = `translate(${{sx + sx2}}px, ${{sy + sy2}}px) translateZ(${{-450 + out * 1700}}px) rotateY(${{-turn * 90}}deg) rotateX(${{(1 - clamp(t / .6)) * 12}}deg)`
    $('f1').style.transform = 'translateZ(450px)'; $('f2').style.transform = 'rotateY(90deg) translateZ(450px)'
    $('hookcam').style.filter = out > 0 ? `blur(${{out * 20}}px)` : 'none'
  }}
  const fl1 = t > W['costó'] + .5 && t < W['costó'] + .58 ? .25 : 0, fl2 = t > W['ganaste'] + .65 && t < W['ganaste'] + .73 ? .18 : 0
  $('flash').style.opacity = fl1 + fl2 + (t > W['es un'] - .12 && t < W['es un'] ? .2 : 0)

  // 2. Desktop analytics flown through; rows lift out of the screen as they are read.
  if (show('cam', t, W['es un'] - .2, W['mismo'] + .35, .15)) {{
    const c = track(CAM, t)
    $('world').style.transform = camCss(c); $('page').style.transform = `translateY(${{-c.scroll}}px)`
    const lift = (id, a, b, y) => {{ const p = Math.min(easeOutBack(clamp((t - a) / .45)), 1 - ease(clamp((t - b) / .35))); const el = $(id); el.style.opacity = clamp(p * 4); el.style.top = (y - c.scroll + 44 - 10) + 'px'; el.style.transform = `translateZ(${{p * 170}}px) scale(${{1 + p * .06}})`; return p }}
    const pe = lift('pE', W['cuatro'] + .5, W['tres'] - .05, 898), pf = lift('pF', W['tres'] + .15, W['16'] - .05, 955), pc = lift('pC', W['16'] + .4, W['mismo'] - .1, 1184)
    const focus = Math.max(pe, pf, pc)
    $('win').style.filter = `blur(${{focus * 5}}px) brightness(${{1 - focus * .45}})`
    const sw = prog(t, W['es un'] + .6, W['es un'] + 1.8); $('sweep').style.opacity = sw > 0 && sw < 1 ? 1 : 0; $('sweep').style.transform = `translateX(${{-1600 + sw * 3200}}px)`
  }}

  // 3. Same market, same account: extruded amounts turning in space.
  if (show('mood', t, W['mismo'] - .05, W['marca'] - .2, .25)) {{
    const rise = (id, at) => {{ const p = easeOutBack(clamp((t - at) / .6)); const el = $(id); el.style.opacity = clamp(p * 3); el.style.transform = `rotateX(${{(1 - p) * -85}}deg) rotateY(${{Math.sin((t - at) * .9) * 22}}deg) translateZ(${{(1 - p) * -400}}px)` }}
    rise('xg', W['mismo'] + .1); rise('xr', W['misma'])
    $('moodw').style.transform = `rotateX(${{8 + Math.sin(t * .7) * 4}}deg) translateZ(${{(t - W['mismo']) * 40}}px)`
  }}

  // 4. Desktop entry form: the emotion is picked with a click.
  if (show('cam2', t, W['marca'] - .3, W['op2'] + .15, .15)) {{
    const c = track(CAM2, t)
    $('world2').style.transform = camCss(c); $('cam2').style.filter = `blur(${{clamp((t - W['op2']) / .3) * 16}}px)`
    const sw = prog(t, W['marca'] + .1, W['marca'] + 1.1); $('sweep2').style.opacity = sw > 0 && sw < 1 ? 1 : 0; $('sweep2').style.transform = `translateX(${{-1600 + sw * 3200}}px)`
    // Cursor path: in from below right, rests on Enojo, moves to Calma and clicks.
    const P = [[W['marca'] + .3, 1200, 900], [W['antes'] - .2, 764, 540], [W['antes'] + .4, 764, 540], [W['antes'] + 1.0, 497, 540]]
    let cx = P[0][1], cy = P[0][2]
    for (let i = 0; i < P.length - 1; i++) if (t >= P[i][0]) {{ const p = ease(clamp((t - P[i][0]) / (P[i + 1][0] - P[i][0]))); cx = lerp(P[i][1], P[i + 1][1], p); cy = lerp(P[i][2], P[i + 1][2], p) }}
    const click = W['antes'] + 1.15, press = t > click && t < click + .12 ? .85 : 1
    const cur = $('cur'); cur.style.left = cx + 'px'; cur.style.top = cy + 'px'; cur.style.opacity = clamp((t - W['marca'] - .3) / .2) * clamp((W['tiltless'] + .3 - t) / .2); cur.style.transform = `scale(${{press}})`
    $('entryC').style.opacity = t >= click + .05 ? 1 : 0
    const rp = clamp((t - click) / .5); const rip = $('ripple'); rip.style.left = '497px'; rip.style.top = '527px'; rip.style.opacity = t > click ? (1 - rp) : 0; rip.style.transform = `scale(${{.3 + rp * 1.2}})`
    const tag = (id, at) => {{ const p = easeOutBack(clamp((t - at) / .5)); const el = $(id); el.style.opacity = clamp(p * 3); el.style.transform = `translateZ(${{p * 320}}px) rotateY(${{(1 - p) * 40}}deg)` }}
    tag('tg', W['tiltless'] + .2); tag('tr', W['tiltless'] + .55)
  }}

  heads(t)
  if (show('end', t, W['op2'] - .05, 999)) {{ const l = prog(t, W['op2'] - .05, W['op2'] + .7); $('end-logo').style.transform = `perspective(800px) rotateY(${{(1 - l) * 180}}deg) scale(${{.7 + .3 * l}})` }}
  subtitles(t)
}}
window.DURATION = {END:.2f}
render(0)
</script></body></html>"""

open('stage-06x.html', 'w').write(html)
print('06x', round(END, 2))
