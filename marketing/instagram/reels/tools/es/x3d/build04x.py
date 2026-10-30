# Reel 04 in 3D: a falling billboard and a split-flap 15:00, a dolly along the evening of Oct 26
# (demo) where three trades open within minutes of a loss, a glass slab hiding them, stamps, a price tag.
import json
from common3d import build, page, win, crop, h1s, save

r = build.Reel('04'); T = r.T
W = {k: T(k) for k in ['nueva', 'esto es', 'tres', 'cero', '$182', 'eso es', 'tasa', 'esconde', 'tiltless', 'marca', 'cualquier', 'así el', 'nombre', 'precio']}
W['necesitas'] = T('necesitas', 2); W['fin'] = T('15 minutos después', 2); W['estr'] = T('esa es')
END = r.end() + 0.9
A, D = 'x3d/shots/analytics-full.png', 'x3d/shots/byday-full.png'

# Evening of Monday Oct 26 in the demo journal: minutes after 7:50 p.m.
PX = 85  # px per minute along the road
EV = [  # (minute, side, title, sub, kind)
    (15, -1, '8:05 p.m.', 'ETHUSDT · pérdida', 'loss'),
    (19, 1, '8:09 p.m.', 'BTCUSDT · abre 4 min después', 'rev'),
    (27, -1, '8:17 p.m.', 'BTCUSDT · pérdida', 'loss'),
    (31, 1, '8:21 p.m.', 'BTCUSDT · abre 4 min después', 'rev'),
    (41, -1, '8:31 p.m.', 'BTCUSDT · pérdida', 'loss'),
    (43, 1, '8:33 p.m.', 'BTCUSDT · abre 2 min después', 'rev'),
]
cards = ''
for i, (m, side, title, sub, kind) in enumerate(EV):
    col = '#f2555a'
    flag = '<div class="ev-flag">Operar por revancha</div>' if kind == 'rev' else ''
    cards += (f'<div class="ev" id="ev{i}" style="left:{side * 200 - (0 if side > 0 else 420)}px;top:-400px;transform:translateZ({-m * PX}px)">'
              f'<div class="ev-t" style="color:{col if kind == "loss" else "#ededed"}">{title}</div><div class="ev-s">{sub}</div>{flag}</div>')
zones = ''.join(f'<div class="zone" id="z{i}" style="top:{m * PX}px;height:{15 * PX}px"></div>' for i, (m, *_rest, kind) in enumerate(EV) if kind == 'loss')
ticks = ''.join(f'<div class="tick" style="top:{m * PX}px"></div>' for m in range(0, 56, 5))

STAMPS = [(438, 100), (537, 101), (638, 101)]
stamps = ''.join(f'<div class="stamp" id="st{i}" style="left:860px;top:{y - 260 + 44 + h / 2 - 40}px">REVANCHA</div>' for i, (y, h) in enumerate(STAMPS))

CSS = """
  .bill { position:absolute; left:110px; width:860px; top:600px; height:420px; border-radius:30px; border:2px solid #ffffff22; background:linear-gradient(180deg,#1d1d1d,#151515);
    display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; font-size:96px; font-weight:800; letter-spacing:-.035em; line-height:1.05; box-shadow:0 40px 120px -20px #000; transform-origin:50% 100% }
  .strike2 { position:absolute; height:14px; border-radius:7px; background:var(--red); box-shadow:0 0 30px #f2555a; clip-path:inset(0 100% 0 0) }
  .flaps { position:absolute; left:0; width:1080px; display:flex; justify-content:center; gap:18px; perspective:900px }
  .flap { width:150px; height:220px; border-radius:18px; background:linear-gradient(180deg,#202020 0 49.5%,#0c0c0c 49.5% 50.5%,#1a1a1a 50.5%); border:2px solid #2e2e2e;
    display:flex; align-items:center; justify-content:center; font:700 170px 'JetBrains Mono', monospace; color:#3ecf8e; text-shadow:0 0 30px #3ecf8e88; box-shadow:0 30px 60px -10px #000 }
  .flap.colon { width:70px; background:none; border:0; box-shadow:none }
  .road { position:absolute; left:-180px; top:0; width:360px; height:5200px; transform-origin:0 0; transform:rotateX(90deg) scaleY(-1);
    background:linear-gradient(90deg,#3ecf8e55 0 4px,transparent 4px calc(100% - 4px),#3ecf8e55 calc(100% - 4px)), #16161699 }
  .zone { position:absolute; left:0; right:0; background:linear-gradient(180deg,#f2555a40,#f2555a0c); border-top:4px solid #f2555a; opacity:0 }
  .tick { position:absolute; left:0; right:0; height:2px; background:#ffffff22 }
  .tick span { position:absolute; left:-120px; top:-22px; font:500 34px 'JetBrains Mono', monospace; color:#a0a0a0 }
  .scene .ev, .scene .ev *, .scene .tag3d, .scene .tag3d *, .scene .glass, .scene .glass *, .scene .ptag * { transform-style:flat }
  .ev { position:absolute; width:420px; padding:28px 32px; border-radius:24px; background:#171717f2; border:2px solid #2e2e2e; box-shadow:0 30px 80px -10px #000; opacity:0 }
  .ev-t { font:700 56px 'JetBrains Mono', monospace } .ev-s { font:500 34px Inter, sans-serif; color:#a0a0a0; margin-top:6px }
  .ev-flag { margin-top:16px; display:inline-block; padding:8px 18px; border-radius:14px; border:2px solid #f2555a; color:#f2555a; font:600 28px Inter, sans-serif; background:#f2555a14; box-shadow:0 0 30px #f2555a55 }
  .glass { position:absolute; left:120px; top:120px; width:1200px; height:640px; border-radius:40px; border:2px solid #ffffff33;
    background:linear-gradient(135deg,#ffffff26,#ffffff08 40%,#3ecf8e14); box-shadow:0 40px 120px -20px #000, inset 0 1px 0 #ffffff44;
    display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center }
  .glass .k { font:500 44px 'JetBrains Mono', monospace; letter-spacing:.12em; color:#a0a0a0 } .glass .v { font:800 260px Inter, sans-serif; letter-spacing:-.05em; color:#ededed; line-height:1 }
  .stamp { position:absolute; padding:10px 34px; border:7px solid #f2555a; border-radius:18px; color:#f2555a; font:800 64px Inter, sans-serif; letter-spacing:.06em; background:#f2555a1a; box-shadow:0 0 50px #f2555a66; opacity:0 }
  .ptag { position:absolute; width:600px; padding:34px 44px 34px 90px; border-radius:22px 40px 40px 22px; background:linear-gradient(180deg,#1f1f1f,#141414); border:3px solid #f2555a; box-shadow:0 0 70px #f2555a55, 0 40px 90px -10px #000; transform-origin:50% -260px }
  .ptag:before { content:''; position:absolute; left:34px; top:50%; width:28px; height:28px; margin-top:-14px; border-radius:50%; background:#121212; border:3px solid #f2555a }
  .ptag .n { font:600 40px Inter, sans-serif; color:#ededed } .ptag .p { font:800 96px 'JetBrains Mono', monospace; color:#f2555a; letter-spacing:-.04em; text-shadow:0 0 30px #f2555a88 }
  .string { position:absolute; left:298px; top:-260px; width:4px; height:262px; background:linear-gradient(#ffffff00,#ffffff88) }
"""


def flaps(prefix):
    return ''.join(f'<div class="flap{" colon" if c == ":" else ""}" id="{prefix}{i}">{c}</div>' for i, c in enumerate('15:00'))


body = f"""<style>{CSS}</style>
<div id="hook" class="layer" style="opacity:1;perspective:1100px;perspective-origin:540px 1000px">
  <div class="bill" id="bill"><div>No necesitas una</div><div style="position:relative">estrategia nueva.<div class="strike2" id="sk" style="left:-20px;right:-20px;top:46%"></div></div></div>
  <div class="flaps" id="fl" style="top:820px;opacity:0">{flaps('fa')}</div>
</div>

<div id="s1" class="layer stage3d" style="perspective:1200px;perspective-origin:540px 820px">
  <div class="scene" id="sc1">
    <div class="gridfloor" style="left:-2000px;top:0;width:4000px;height:6000px;transform-origin:0 0;transform:rotateX(90deg) scaleY(-1) translateY(-600px);-webkit-mask-image:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent)"></div>
    <div class="road" id="road">{ticks}{zones}</div>
    {cards}
  </div>
  <div style="position:absolute;inset:0;perspective:1000px"><div class="tag3d r" id="cost" style="left:200px;width:680px;text-align:center;top:860px;opacity:0;font-size:110px"><span style="display:block;font-size:40px;margin:0 0 8px">Operar por revancha · costo</span>−$182.50</div></div>
</div>

<div id="s2" class="layer stage3d" style="perspective:1400px;perspective-origin:540px 900px">
  <div class="scene" id="sc2">
    {win('w2', '#/trades', D)}
    <div class="glass" id="glass"><div class="k">TASA DE ACIERTO</div><div class="v">52%</div><div class="k" style="margin-top:10px">PARECE NORMAL</div></div>
    {stamps}
    <div id="scan" style="position:absolute;left:0;width:1440px;height:8px;background:linear-gradient(90deg,transparent,#f2555a,transparent);box-shadow:0 0 40px #f2555a;opacity:0"></div>
  </div>
</div>

<div id="s3" class="layer stage3d" style="perspective:1400px;perspective-origin:540px 900px">
  <div class="scene" id="sc3">
    {win('w3', '#/analytics', A)}
    <div class="ptag" id="ptag" style="left:560px;top:600px"><div class="string"></div><div class="n">Operar por revancha</div><div class="p">−$182.50</div></div>
  </div>
</div>
"""

heads_html = h1s([
    'Necesitas <span class="g">15 minutos</span><br>después de una pérdida.', 'Esto es un<br>mes de demostración.',
    '3 operaciones abiertas<br><span class="r">a menos de 15 min</span><br>de una pérdida.', 'Cero ganadoras.<br><span class="r">−$182.</span>',
    'Operar por revancha.<br>La tasa de acierto<br><span class="r">lo esconde.</span>', 'Tiltless lo marca<br><span class="g">por ti.</span>',
    'Cualquier operación a<br><span class="r">menos de 15 min</span><br>de una pérdida.', 'Así el patrón por fin tiene<br><span class="g">nombre y precio.</span>'])

end_html = build.end_card('15 minutos después de una pérdida.<br><span class="g">Esa es la estrategia.</span>', 'El diario es gratis · Pro 30 días gratis').replace(
    '<img class="logo" id="end-logo" src="shots/logo.svg" style="top:340px">',
    f'<div class="flaps" id="fl2" style="top:330px;perspective:900px">{flaps("fb")}</div><img class="logo" id="end-logo" src="shots/logo.svg" style="top:340px;opacity:0">')

js = f"""
const W = {json.dumps(W)}
const PX = {PX}
labels(t, [[W['esto es'] - .1, '<b>Lunes 26 de octubre</b> · demo'], [W['eso es'] - .1, '<b>Operaciones</b> · demo · escritorio'], [W['así el'] - .1, '<b>Costo de los errores</b> · demo'], [W['fin'] - .1, '']])
heads(t, [[W['necesitas'], 'hd0'], [W['esto es'] - .1, 'hd1'], [W['tres'], 'hd2'], [W['cero'], 'hd3'], [W['eso es'] - .1, 'hd4'], [W['tiltless'] - .1, 'hd5'], [W['cualquier'], 'hd6'], [W['así el'] - .1, 'hd7'], [W['fin'] - .1, null]])
$('flash').style.opacity = flashAt(t, [[W['$182'] + .1, .18], [W['esto es'] - .1, .12]])
// Split-flap: each tile spins through digits, then settles on its own character.
function flapBoard(prefix, t, at) {{
  const chars = '15:00', pool = '0123456789'
  for (let i = 0; i < 5; i++) {{
    const el = $(prefix + i), settle = at + .25 + i * .09
    if (chars[i] === ':') {{ el.style.opacity = t > at ? 1 : 0; continue }}
    const spin = t < settle, k = Math.floor((t - at) / .055)
    el.textContent = t < at ? '' : spin ? pool[(k * 7 + i * 3) % 10] : chars[i]
    const ph = spin ? ((t - at) / .055) % 1 : clamp((t - settle) / .15) + 1
    el.style.transform = spin ? `rotateX(${{-90 + ph * 90}}deg)` : `rotateX(${{(1 - easeOutBack(clamp((t - settle) / .25))) * -40}}deg)`
    el.style.opacity = t > at ? 1 : 0
  }}
}}

// Hook: the billboard's "new strategy" is struck out and it falls; the board flips to 15:00.
if (show('hook', t, 0, W['esto es'] - .05, .15)) {{
  const inn = easeOutBack(clamp((t - .3) / .5))
  $('sk').style.clipPath = `inset(0 ${{(1 - prog(t, W['nueva'] + .1, W['nueva'] + .4)) * 100}}% 0 0)`
  const fall = clamp((t - W['necesitas'] + .1) / .55)
  $('bill').style.transform = `translateZ(${{(1 - inn) * -700}}px) rotateX(${{-fall * fall * 92 + Math.sin(t * 1.3) * 3 * (1 - fall)}}deg)`; $('bill').style.opacity = clamp(inn * 3) * (1 - clamp((fall - .8) * 5))
  $('fl').style.opacity = t > W['necesitas'] + .4 ? 1 : 0; flapBoard('fa', t, W['necesitas'] + .45)
  const out = clamp((t - (W['esto es'] - .45)) / .4); $('fl').style.transform = `translateZ(${{out * 900}}px)`; $('fl').style.filter = out > 0 ? `blur(${{out * 16}}px)` : 'none'
}}

// The evening laid out as a road: the camera rides along it; red zones are the 15 minutes after each loss.
if (show('s1', t, W['esto es'] - .2, W['eso es'] - .05, .2)) {{
  const ride = (m) => -m * PX
  const c = track([
    [W['esto es'] - .2, {{ x: 0, y: -900, w: 900, z: -400, rx: -55, ry: 0, rz: 0 }}],
    [W['esto es'] + 1.0, {{ x: 0, y: -380, w: ride(6), z: -250, rx: -16, ry: 0, rz: 0 }}, 'expo'],
    [W['tres'] + .6, {{ x: 40, y: -380, w: ride(22), z: -250, rx: -14, ry: -8, rz: 0 }}],
    [W['cero'] - .4, {{ x: -40, y: -380, w: ride(44), z: -250, rx: -14, ry: 8, rz: 0 }}],
    [W['$182'], {{ x: 0, y: -500, w: ride(30), z: -1500, rx: -40, ry: 0, rz: 0 }}],
    [W['eso es'], {{ x: 0, y: -520, w: ride(30), z: -1400, rx: -40, ry: 10, rz: 0 }}],
  ], t)
  $('sc1').style.transform = camCss(c)
  const now = -c.w / PX;
  ;{json.dumps([[i, m] for i, (m, *_r) in enumerate(EV)])}.forEach(([i, m]) => {{ const p = easeOutBack(clamp((now - m + 7) / 3)); const el = $('ev' + i); el.style.opacity = clamp(p * 3) * clamp((m + 3.5 - now) / 1.5); el.style.transform = `translateZ(${{-m * PX}}px) rotateY(${{(1 - p) * 70 * (i % 2 ? -1 : 1)}}deg) scale(${{.8 + .2 * p}})` }})
  ;{json.dumps([[i, m] for i, (m, *_r) in enumerate(EV) if _r[-1] == 'loss'])}.forEach(([i, m]) => {{ const z = $('z' + i); if (z) z.style.opacity = clamp((now - m + 4) / 2) }})
  const cp = easeOutBack(clamp((t - W['$182'] + .05) / .5)); $('cost').style.opacity = clamp(cp * 3); $('cost').style.transform = `translateZ(${{(1 - cp) * -900}}px) rotateX(${{(1 - cp) * 60}}deg)`
}}

// The same evening in the app; a glass slab with the win rate slides over it, then the stamps land.
if (show('s2', t, W['eso es'] - .1, W['así el'] - .05, .2)) {{
  const S = 260
  $('w2-img').style.transform = `translateY(${{-S}}px)`
  const c = track([
    [W['eso es'] - .1, {{ x: 720, y: 400, z: -1300, rx: 30, ry: -30, rz: -6 }}],
    [W['eso es'] + .9, {{ x: 720, y: 400, z: -520, rx: 10, ry: -12, rz: -2 }}, 'expo'],
    [W['tiltless'], {{ x: 760, y: 420, z: -440, rx: 6, ry: 8, rz: 0 }}],
    [W['cualquier'] + 1.5, {{ x: 820, y: 400, z: -300, rx: 12, ry: 14, rz: 1 }}],
    [W['así el'], {{ x: 820, y: 380, z: -200, rx: 14, ry: 18, rz: 1 }}],
  ], t)
  $('sc2').style.transform = camCss(c)
  const g = ease(clamp((t - W['tasa'] + .2) / .6)) * (1 - ease(clamp((t - W['tiltless'] + .2) / .5)))
  $('glass').style.transform = `translateX(${{(1 - g) * 1700}}px) translateZ(${{140 + g * 40}}px) rotateY(${{(1 - g) * -25}}deg)`
  $('w2').style.filter = `blur(${{g * 9}}px) brightness(${{1 - g * .35}})`
  const sp = clamp((t - W['marca'] + .1) / 1.4); $('scan').style.opacity = sp > 0 && sp < 1 ? 1 : 0; $('scan').style.top = (44 + 150 + sp * 520) + 'px'; $('scan').style.transform = 'translateZ(6px)'
  ;[0, 1, 2].forEach((i) => {{ const at = W['marca'] + .1 + i * .42, p = clamp((t - at) / .22); const el = $('st' + i); el.style.opacity = p > 0 ? 1 : 0
    el.style.transform = `translateZ(${{(1 - easeOutBack(p)) * 700 + 8}}px) rotateZ(${{-8 + i * 5}}deg) scale(${{1 + (1 - p) * .6}})` }})
  const sh = shake(t, W['marca'] + .32, .2, 10); if (sh[0]) $('sc2').style.transform = `translate(${{sh[0]}}px, ${{sh[1]}}px) ` + camCss(c)
}}

// The pattern gets its name and its price: a tag swings on a string in front of the row.
if (show('s3', t, W['así el'] - .1, W['fin'] - .05, .2)) {{
  const S = 700
  $('w3-img').style.transform = `translateY(${{-S}}px)`
  const c = track([
    [W['así el'] - .1, {{ x: 553, y: 44 + 1149 - S, z: -1100, rx: -20, ry: 30, rz: 4 }}],
    [W['así el'] + .9, {{ x: 620, y: 44 + 1149 - S + 30, z: -300, rx: -6, ry: 10, rz: 0 }}, 'expo'],
    [W['fin'], {{ x: 640, y: 44 + 1149 - S + 40, z: -200, rx: -4, ry: 4, rz: 0 }}],
  ], t)
  $('sc3').style.transform = camCss(c)
  const at = W['nombre'] - .1, p = clamp((t - at) / .4), sw = t < at ? 0 : Math.exp(-(t - at) * 2.2) * Math.cos((t - at) * 7.5)
  $('ptag').style.opacity = clamp(p * 3); $('ptag').style.top = (44 + 1149 - S + 60) + 'px'
  $('ptag').style.transform = `translateZ(${{220}}px) translateY(${{(1 - easeOutBack(p)) * -500}}px) rotateZ(${{sw * 22}}deg) rotateY(${{sw * 25}}deg)`
  $('w3').style.filter = `blur(${{p * 3}}px) brightness(${{1 - p * .3}})`
}}

if (show('end', t, W['fin'] - .05, 999)) {{ flapBoard('fb', t, W['fin']); $('fl2').style.opacity = 1 - prog(t, W['estr'] + .2, W['estr'] + .6); $('end-logo').style.opacity = prog(t, W['estr'] + .3, W['estr'] + .7); $('end-logo').style.transform = `rotateX(${{(1 - prog(t, W['estr'] + .3, W['estr'] + .8)) * 90}}deg)` }}
"""

cues = [['whoosh', 0.1, .6, .3], ['laser', W['nueva'] + .1, .3], ['whoosh', W['necesitas'] - .1, .6, .35], ['thud', W['necesitas'] + .45, .45],
        ['flaps', W['necesitas'] + .45, .7], ['whoosh', W['esto es'] - .5, 1.2, .5],
        ['ping', W['tres'] - .1, .2], ['ping', W['tres'] + 1.0, .2], ['ping', W['tres'] + 2.1, .2], ['whoosh', W['cero'] - .4, 1.0, .4], ['impact', W['$182'] + .1, .4, 70],
        ['whoosh', W['eso es'] - .3, .9, .45], ['whoosh', W['tasa'] - .3, .7, .3], ['whoosh', W['tiltless'] - .3, .6, .25],
        ['stamp', W['marca'] + .3, .5], ['stamp', W['marca'] + .72, .5], ['stamp', W['marca'] + 1.14, .5],
        ['whoosh', W['así el'] - .3, .8, .4], ['pop', W['nombre'] + .2, .3, 600], ['whoosh', W['fin'] - .3, .6, .35], ['flaps', W['fin'], .6], ['impact', W['estr'] + .4, .3, 55]]
save('04', page(r, body, js, heads_html, end_html, END), cues)
print('04x', round(END, 2))
