# Reel 03 in 3D: a receipt of mistakes stamped "30 días gratis", a gift box that releases the Pro page,
# cost rows extruding out of the screen, a clock dial whose first hour lifts, chunks bitten off the account,
# a calendar flipping to Nov 30, and two doors that open onto the journal.
import json
from common3d import build, page, win, crop, bar_html, h1s, save

r = build.Reel('03'); T = r.T
W = {k: T(k) for k in ['mira', '30', 'tiltless', 'primer', 'cada', 'malas', '$332', 'también', 'menos de una', '$1475', 'ahora', 'comiendo', 'el diario', 'registrate', 'sin pagar', 'después', 'tus operaciones']}
W['30b'] = T('30', 2); W['fin'] = T('mira', 2)
END = r.end() + 0.9
A, P, TR = 'x3d/shots/analytics-full.png', 'x3d/shots/pro-view.png', 'x3d/shots/trades-view.png'

ROWS = [(898, 332.5), (971, 280), (1045, 260), (1118, 182.5)]  # mistake-cost rows on the analytics page
NAMES = ['Malas horas', 'Aguantó pasado el stop', 'FOMO', 'Operar por revancha']
slabs = ''.join(f'<div class="tagx r" id="pt{i}" style="left:0;top:0;opacity:0;font-size:60px"><span>{NAMES[i]}</span>−${c:,.2f}</div>' for i, (_y, c) in enumerate(ROWS))

CSS = """
  .scene .slab { transform-style:preserve-3d } .scene .slab > div { transform-style:flat; position:absolute }
  .scene .receipt *, .scene .door *, .scene .tagx, .scene .tagx *, .scene .gift-lbl * { transform-style:flat }
  .receipt { position:absolute; left:190px; top:560px; width:700px; font-size:34px !important; background:#efeee8; color:#151515; border-radius:6px; padding:34px 40px 50px;
    font:600 30px 'JetBrains Mono', monospace; box-shadow:0 50px 100px -20px #000; transform-origin:50% 0 }
  .receipt:after { content:''; position:absolute; left:0; right:0; bottom:-14px; height:16px; background:radial-gradient(circle at 10px -2px, transparent 11px, #efeee8 12px) 0 0/20px 16px repeat-x }
  .receipt .h { text-align:center; font-weight:800; font-size:34px; letter-spacing:.08em } .receipt .s { text-align:center; color:#666; font-size:24px; margin:6px 0 22px }
  .receipt .l { display:flex; justify-content:space-between; padding:12px 0; border-top:2px dashed #bbb; opacity:0 } .receipt .l b { color:#c8333a }
  .slot { position:absolute; left:200px; top:530px; width:680px; height:44px; border-radius:22px; background:#0a0a0a; border:2px solid #2e2e2e; box-shadow:inset 0 6px 14px #000, 0 0 40px #3ecf8e33 }
  .stampg { position:absolute; left:250px; top:860px; width:580px; text-align:center; padding:16px 0; border:9px solid #1f9d68; border-radius:22px; color:#1f9d68; font:800 74px Inter, sans-serif; letter-spacing:.04em; opacity:0; mix-blend-mode:multiply }
  .dial { position:absolute; left:-330px; top:-330px; width:660px; height:660px }
  .cal { position:absolute; left:290px; top:640px; width:500px; height:520px; perspective:1400px }
  .page { position:absolute; inset:0; border-radius:34px; background:#1a1a1a; border:3px solid #2e2e2e; overflow:hidden; transform-origin:50% 0; backface-visibility:hidden; text-align:center; box-shadow:0 30px 70px -10px #000 }
  .page .m { background:#2a2a2a; color:#ededed; font:700 64px 'JetBrains Mono', monospace; padding:16px 0; letter-spacing:.12em } .page .d { font:800 270px Inter, sans-serif; letter-spacing:-.05em; line-height:1.3 }
  .page.g { border-color:#3ecf8e; box-shadow:0 0 90px #3ecf8e55 } .page.g .m { background:#3ecf8e; color:#121212 }
  .rings { position:absolute; left:340px; top:612px; width:400px; display:flex; justify-content:space-between; z-index:3 } .rings i { width:26px; height:60px; border-radius:13px; background:#555; box-shadow:inset 0 0 6px #000 }
  .door { position:absolute; top:-430px; width:520px; height:860px; border-radius:28px; background:linear-gradient(180deg,#1d1d1d,#151515); border:3px solid #2e2e2e; box-shadow:0 40px 100px -10px #000;
    display:flex; flex-direction:column; justify-content:center; padding:0 50px }
  .door .t { font:800 84px Inter, sans-serif; letter-spacing:-.03em; line-height:1.05 } .door .s { font:500 42px Inter, sans-serif; color:#a0a0a0; margin-top:20px }
  .door .knob { position:absolute; top:50%; width:22px; height:90px; margin-top:-45px; border-radius:11px; background:#3a3a3a }
  .tagx { position:absolute; padding:22px 34px; border-radius:24px; background:#121212f2; font:800 76px 'JetBrains Mono', monospace; white-space:nowrap }
  .tagx span { display:block; font:600 34px Inter, sans-serif; color:#ededed; margin-bottom:6px }
  .tagx.r { color:#f2555a; border:4px solid #f2555a; box-shadow:0 0 70px #f2555a66, 0 40px 80px -10px #000 } .tagx.g { color:#3ecf8e; border:4px solid #3ecf8e; box-shadow:0 0 70px #3ecf8e66, 0 40px 80px -10px #000 }
"""

DIAL = """<svg viewBox="-330 -330 660 660" class="dial" style="overflow:visible">
<circle r="300" fill="#151515" stroke="#2e2e2e" stroke-width="4"/>
{ticks}
<path d="{green}" fill="none" stroke="#3ecf8e" stroke-width="60" style="filter:drop-shadow(0 0 18px #3ecf8e)"/>
</svg>"""
import math
def arc(a0, a1, rad=230):
    p = lambda a: (rad * math.sin(a), -rad * math.cos(a))
    (x0, y0), (x1, y1) = p(a0), p(a1)
    return f'M {x0:.1f} {y0:.1f} A {rad} {rad} 0 {1 if a1 - a0 > math.pi else 0} 1 {x1:.1f} {y1:.1f}'
Q = math.pi / 2  # one hour of a four-hour dial
ticks = ''.join(f'<line x1="0" y1="-300" x2="0" y2="-270" stroke="#555" stroke-width="5" transform="rotate({k * 90})"/><text x="{275 * math.sin(k * Q) * .82:.0f}" y="{-275 * math.cos(k * Q) * .82 + 12:.0f}" fill="#a0a0a0" font-family="JetBrains Mono" font-size="34" text-anchor="middle">{k} h</text>' for k in range(4))
dial_svg = DIAL.format(ticks=ticks, green=arc(Q + .03, 4 * Q - .03))
red_layers = ''.join(f'<svg viewBox="-330 -330 660 660" class="dial rl" style="overflow:visible;transform:translateZ({k * 6}px)"><path d="{arc(.03, Q - .03)}" fill="none" stroke="{"#f2555a" if k == 10 else "#8a2a2e"}" stroke-width="60"{" style=\"filter:drop-shadow(0 0 22px #f2555a)\"" if k == 10 else ""}/></svg>' for k in range(11))

body = f"""<style>{CSS}</style>
<div id="s0" class="layer stage3d" style="opacity:1;perspective:1300px;perspective-origin:540px 900px">
  <div id="rc" style="position:absolute;inset:0;transform-style:preserve-3d">
    <div class="slot"></div>
    <div class="receipt" id="receipt"><div class="h">TILTLESS · RECIBO</div><div class="s">mes de demostración</div>
      <div class="l" id="l0"><span>Malas horas</span><b>−$332.50</b></div><div class="l" id="l1"><span>Pasó el stop</span><b>−$280.00</b></div>
      <div class="l" id="l2"><span>FOMO</span><b>−$260.00</b></div><div class="l" id="l3"><span>Revancha</span><b>−$182.50</b></div>
      <div class="stampg" id="stamp" style="left:10px;top:150px">30 DÍAS GRATIS</div></div>
  </div>
</div>

<div id="s1" class="layer stage3d" style="perspective:1300px;perspective-origin:540px 900px">
  <div class="scene" id="sc1">
    <div id="box" style="position:absolute;left:0;top:0">{bar_html('gift', '#1f9d68')}</div>
    <div id="lid" style="position:absolute;left:0;top:0">{bar_html('lidb', '#3ecf8e')}</div>
    <div id="prow" style="position:absolute;left:0;top:0">{win('w1', '#/pro', P, '<div id="offer" style="position:absolute;left:287px;top:366px;width:614px;height:83px;border:4px solid #3ecf8e;border-radius:14px;box-shadow:0 0 50px #3ecf8e;opacity:0"></div>')}</div>
  </div>
</div>

<div id="s2" class="layer stage3d" style="perspective:1400px;perspective-origin:540px 900px">
  <div class="scene" id="sc2f">{win('w2', '#/analytics', A)}</div><div class="scene" id="sc2">{slabs}
</div>
</div>

<div id="s3" class="layer stage3d" style="perspective:1300px;perspective-origin:540px 860px">
  <div class="scene" id="sc3"><div id="dialw" style="position:absolute;left:0;top:0">{dial_svg}<div id="redarc" style="position:absolute;left:0;top:0">{red_layers}</div></div>
    <div class="tagx r" id="t1475" style="left:-400px;top:-330px;opacity:0"><span>Menos de una hora · 11 operaciones</span>−$1,475</div></div>
</div>

<div id="s4" class="layer stage3d" style="perspective:1300px;perspective-origin:540px 860px">
  <div class="scene" id="sc4">
    <div style="position:absolute;left:0;top:0">{bar_html('acct', '#3ecf8e', '<div class="gift-lbl" style="position:absolute;left:-300px;width:600px;top:-120px;text-align:center"><div style="font:800 64px Inter, sans-serif;color:#121212;letter-spacing:-.02em">TU CUENTA</div></div>')}</div>
    {''.join(f'<div class="chunk" id="ch{i}" style="position:absolute;left:0;top:0">{bar_html(f"chb{i}", "#f2555a", f"<div class=gift-lbl style=\"position:absolute;left:-125px;width:250px;top:-190px;text-align:center;transform:translateZ(90px)\"><div style=\"font:700 30px Inter, sans-serif;color:#ededed\">{n}</div><div style=\"font:700 42px JetBrains Mono, monospace;color:#f2555a\">{a}</div></div>")}</div>' for i, (n, a) in enumerate([('Malas horas', '−$332'), ('Pasó el stop', '−$280'), ('FOMO', '−$260')]))}
  </div>
</div>

<div id="s5" class="layer stage3d" style="perspective:1300px;perspective-origin:540px 900px">
  <div class="scene" id="sc5"><div id="freec" style="position:absolute;left:0;top:0">{crop('fc', P, 272, 555, 562, 405, 'g', 0, 'transform:scale(1.5);transform-origin:0 0')}</div></div>
</div>

<div id="s6" class="layer"><div class="rings"><i></i><i></i></div><div class="cal" id="cal">{''.join(f'<div class="page{" g" if i == 0 else ""}" id="pg{i}"><div class="m">{m}</div><div class="d">{d}</div></div>' for i, (m, d) in enumerate([('NOV', '30'), ('NOV', '23'), ('NOV', '16'), ('NOV', '9'), ('NOV', '2'), ('OCT', '30')]))}</div>
  <div class="center" id="nopay" style="top:1215px;opacity:0"><span class="pill-g" style="font-size:36px;white-space:nowrap">30 DÍAS DE PRO · SIN PAGO</span></div></div>

<div id="s7" class="layer stage3d" style="perspective:1400px;perspective-origin:540px 900px">
  <div class="scene" id="sc7">
    <div style="position:absolute;left:-720px;top:-472px;transform:translateZ(-260px)">{win('w7', '#/trades', TR)}</div>
    <div class="door" id="dl" style="left:-530px;transform-origin:0 50%"><div class="t">Quédate con <span class="g">Pro</span></div><div class="s">$15.99 al mes<br>o $44.99 al año</div><div class="knob" style="right:30px"></div></div>
    <div class="door" id="dr" style="left:10px;transform-origin:100% 50%"><div class="t">O sigue gratis</div><div class="s">Tu diario y tus<br>operaciones se quedan</div><div class="knob" style="left:30px"></div></div>
  </div>
</div>
"""

heads_html = h1s([
    'Mira cuánto te<br><span class="r">cuestan tus errores.</span>', 'Tiltless Pro acaba de salir.<br><span class="g">El primer mes va por nuestra cuenta.</span>',
    'Cada error tiene<br>su precio en dólares.', 'También cuenta<br>el tiempo en la operación.', 'Menos de una hora:<br><span class="r">−$1,475.</span>',
    'Ahora sabes qué hábito<br><span class="r">se come tu cuenta.</span>', 'El diario<br><span class="g">sigue siendo gratis.</span>', 'Regístrate antes del<br><span class="g">30 de noviembre.</span>',
    'Después,<br>tú decides.', 'Tus operaciones<br><span class="g">se quedan donde están.</span>'])

end_html = build.end_card('Mira cuánto te<br><span class="r">cuestan tus errores.</span>', build.PRO_SMALL)

js = f"""
const W = {json.dumps(W)}
labels(t, [[0, '<b>Lo que costó</b> · mes de demostración'], [W['tiltless'] - .1, '<b>Nuevo</b> · Tiltless Pro'], [W['cada'] - .1, '<b>Costo de los errores</b> · demo'], [W['también'] - .1, '<b>Tiempo en posición</b> · demo'], [W['ahora'] - .1, '<b>Mes de demostración</b>'], [W['el diario'] - .1, '<b>Plan gratis</b> · para siempre'], [W['registrate'] - .1, '<b>Oferta de lanzamiento</b> · tiltless.xyz'], [W['después'] - .1, '<b>Después</b> · tú decides'], [W['fin'] - .1, '']])
heads(t, [[0, 'hd0'], [W['tiltless'] - .1, 'hd1'], [W['cada'] - .1, 'hd2'], [W['también'] - .1, 'hd3'], [W['menos de una'], 'hd4'], [W['ahora'] - .1, 'hd5'], [W['el diario'] - .1, 'hd6'], [W['registrate'] - .1, 'hd7'], [W['después'] - .1, 'hd8'], [W['tus operaciones'], 'hd9'], [W['fin'] - .1, null]])
$('flash').style.opacity = flashAt(t, [[W['30'] + .3, .2], [W['$1475'] + .15, .15], [W['30b'] + .2, .15]])

// 1. A receipt prints the month's mistakes; a green stamp lands on it.
if (show('s0', t, 0, W['tiltless'] - .05, .1)) {{
  const pr = ease(clamp((t - .05) / 1.6)), [sx, sy] = shake(t, W['30'] + .3, .3, 14)
  $('receipt').style.clipPath = `inset(0 0 ${{(1 - pr) * 100}}% 0)`
  $('receipt').style.transform = `translateY(${{-40 + pr * 40}}px)`
  ;[0, 1, 2, 3].forEach((i) => $('l' + i).style.opacity = clamp((pr - .3 - i * .15) / .1))
  const out = clamp((t - (W['tiltless'] - .45)) / .4)
  $('rc').style.transform = `translate(${{sx}}px, ${{sy}}px) rotateX(${{18 - out * 60}}deg) rotateY(${{-14 + Math.sin(t * .9) * 6}}deg) rotateZ(-3deg) translateZ(${{out * 600}}px)`
  $('rc').style.opacity = 1 - out
  const sp = clamp((t - W['30'] - .05) / .3); $('stamp').style.opacity = sp > 0 ? .95 : 0; $('stamp').style.transform = `rotate(-9deg) scale(${{1 + (1 - easeOutBack(sp)) * 1.6}})`
}}

// 2. A gift box: the lid pops, the Pro page rises out of it, the launch offer lights up.
if (show('s1', t, W['tiltless'] - .1, W['cada'] - .05, .15)) {{
  const c = track([[W['tiltless'] - .1, {{ x: 0, y: -150, w: 0, z: -700, rx: -28, ry: 30, rz: 0 }}], [W['tiltless'] + 1.4, {{ x: 0, y: -620, w: 0, z: -500, rx: -10, ry: 6, rz: 0 }}], [W['cada'], {{ x: 0, y: -680, w: 0, z: -280, rx: -4, ry: -4, rz: 0 }}]], t)
  $('sc1').style.transform = camCss(c)
  const bp = easeOutBack(clamp((t - W['tiltless'] + .1) / .5)); bar('gift', 300 * bp + .01, 420, 420)
  const lp = clamp((t - W['tiltless'] - .45) / .7); bar('lidb', 60, 460, 460)
  $('lid').style.transform = `translate3d(${{lp * 260}}px, ${{-300 * bp - lp * 520}}px, ${{lp * 200}}px) rotateZ(${{lp * 40}}deg) rotateX(${{lp * 50}}deg)`; $('lid').style.opacity = 1 - clamp((lp - .6) * 2.5)
  const up = ease(clamp((t - W['tiltless'] - .6) / 1.0))
  $('prow').style.transform = `translate3d(-450px, ${{-260 - up * 800}}px, 0) scale(${{.62}})`; $('prow').style.opacity = clamp(up * 4)
  $('offer').style.opacity = prog(t, W['primer'] - .1, W['primer'] + .2)
}}

// 3. Each cost row extrudes out of the screen, as deep as it cost.
if (show('s2', t, W['cada'] - .1, W['también'] - .05, .15)) {{
  $('w2-img').style.transform = 'translateY(-700px)'
  const c = track([[W['cada'] - .1, {{ x: 640, y: 300, z: -1000, rx: 6, ry: 34, rz: 0 }}], [W['cada'] + 1.0, {{ x: 760, y: 300, z: -600, rx: 4, ry: 22, rz: 0 }}, 'expo'], [W['malas'], {{ x: 800, y: 290, z: -560, rx: 4, ry: 18, rz: 0 }}], [W['también'], {{ x: 820, y: 290, z: -500, rx: 4, ry: 14, rz: 0 }}]], t)
  $('sc2').style.transform = $('sc2f').style.transform = camCss(c)
  ;{json.dumps([44 + y - 700 + 31 for y, _c in ROWS])}.forEach((ry, i) => {{
    const p = easeOutBack(clamp((t - W['cada'] - .4 - i * .3) / .6)), q = ease(clamp((t - W['cada'] - .4 - i * .3) / .6))
    const hot = t > W['malas'] ? (i === 0 ? 1 : -1) : 0, h = clamp((t - W['malas']) / .3)
    const el = $('pt' + i); el.style.opacity = clamp(q * 3); el.style.filter = hot < 0 ? `brightness(${{1 - h * .55}})` : 'none'
    const x = lerp(560, 700 + i * 18, p), y = lerp(ry - 40, -10 + i * 178, p), z = lerp(0, 220 + (hot > 0 ? h * 90 : 0), p)
    el.style.transform = `translate3d(${{x}}px, ${{y}}px, ${{z}}px) rotateY(${{-22 + (1 - q) * 30}}deg) scale(${{lerp(.4, 1, q) * (hot > 0 ? 1 + h * .12 : 1)}})`
    if (i === 0) el.style.boxShadow = hot > 0 ? `0 0 ${{70 + h * 60}}px #f2555a, 0 40px 80px -10px #000` : ''
  }})
  const rowHot = $('w2-sweep'); rowHot.style.opacity = 0
}}

// 4. A four-hour dial; the first hour lifts off it.
if (show('s3', t, W['también'] - .1, W['ahora'] - .05, .2)) {{
  const c = track([[W['también'] - .1, {{ x: 0, y: 0, w: 0, z: -900, rx: 70, ry: 0, rz: -60 }}], [W['también'] + 1.2, {{ x: 0, y: -60, w: 0, z: -420, rx: 50, ry: 0, rz: -10 }}, 'expo'], [W['ahora'], {{ x: 0, y: -120, w: 0, z: -360, rx: 44, ry: 0, rz: 8 }}]], t)
  $('sc3').style.transform = camCss(c)
  const lift = easeOutBack(clamp((t - W['menos de una'] - .1) / .6))
  $('redarc').style.transform = `translateZ(${{lift * 90}}px)`
  document.querySelectorAll('.rl').forEach((el, k) => el.style.transform = `translateZ(${{k * 6 * (.2 + lift)}}px)`)
  const tp = easeOutBack(clamp((t - W['$1475']) / .5)); $('t1475').style.opacity = clamp(tp * 3); $('t1475').style.transform = `translateZ(${{200 + tp * 120}}px) rotateX(${{-c.rx}}deg) rotateZ(${{-c.rz}}deg)`
}}

// 5. Chunks of the account fly off: the habits eating it.
if (show('s4', t, W['ahora'] - .1, W['el diario'] - .05, .2)) {{
  const c = track([[W['ahora'] - .1, {{ x: 0, y: -200, w: 0, z: -900, rx: -20, ry: -40, rz: 0 }}], [W['ahora'] + .8, {{ x: 0, y: -300, w: 0, z: -600, rx: -18, ry: -12, rz: 0 }}, 'expo'], [W['el diario'], {{ x: 0, y: -340, w: 0, z: -560, rx: -14, ry: 4, rz: 0 }}]], t)
  $('sc4').style.transform = camCss(c)
  const eat = clamp((t - W['comiendo']) / .9)
  bar('acct', 320 - eat * 90, 640, 240)
  ;[-260, 0, 260].forEach((x, i) => {{ const p = easeOutExpo(clamp((t - W['comiendo'] - i * .12) / .7)); bar('chb' + i, 90, 130, 130)
    $('ch' + i).style.transform = `translate3d(${{x}}px, ${{-320 - p * (220 + (i === 1 ? 40 : 0))}}px, ${{p * 380}}px) rotateX(${{p * 8}}deg)`; $('ch' + i).querySelector('.gift-lbl').style.opacity = clamp(p * 2) }})
}}

// 6. The free plan card spins in.
if (show('s5', t, W['el diario'] - .1, W['registrate'] - .05, .15)) {{
  const p = easeOutBack(clamp((t - W['el diario'] + .1) / .8))
  $('sc5').style.transform = `translateZ(${{-200 + p * 100}}px)`
  $('freec').style.transform = `translate(-421px, -280px) rotateY(${{(1 - p) * 300}}deg) rotateX(${{Math.sin(t * 1.2) * 6}}deg)`
}}

// 7. A desk calendar flips from Oct 30 to Nov 30.
if (show('s6', t, W['registrate'] - .1, W['después'] - .05, .15)) {{
  const n = 5
  for (let i = 0; i <= n; i++) {{ const at = W['registrate'] + .1 + (n - i) * .17, p = ease(clamp((t - at) / .2)); const el = $('pg' + i)
    el.style.transform = i === 0 ? `scale(${{1 + (1 - easeOutBack(clamp((t - at) / .5))) * -.1}})` : `rotateX(${{p * 160}}deg)`; el.style.zIndex = 10 - i; el.style.opacity = i === 0 || p < .98 ? 1 : 0 }}
  $('cal').style.transform = `rotateX(${{12 + Math.sin(t) * 3}}deg) rotateY(${{Math.sin(t * .8) * 10}}deg)`
  const np = clamp((t - W['sin pagar']) / .3); $('nopay').style.opacity = np; $('nopay').style.transform = `scale(${{.85 + .15 * easeOutBack(np)}})`
}}

// 8. Two doors, two choices; both swing open onto the journal, which stays where it was.
if (show('s7', t, W['después'] - .1, W['fin'] - .05, .15)) {{
  const c = track([[W['después'] - .1, {{ x: 0, y: 0, w: 0, z: -800, rx: 0, ry: -20, rz: 0 }}], [W['después'] + .7, {{ x: 0, y: 0, w: 0, z: -560, rx: 4, ry: 0, rz: 0 }}, 'expo'], [W['fin'], {{ x: 0, y: 0, w: -200, z: -260, rx: 6, ry: 0, rz: 0 }}]], t)
  $('sc7').style.transform = camCss(c)
  const o = ease(clamp((t - W['tus operaciones'] + .2) / .8))
  $('dl').style.transform = `rotateY(${{-o * 105}}deg)`; $('dr').style.transform = `rotateY(${{o * 105}}deg)`
  $('w7').style.boxShadow = `0 0 ${{o * 140}}px #3ecf8e${{o > .5 ? '88' : '22'}}`
}}

if (show('end', t, W['fin'] - .05, 999)) {{ const l = prog(t, W['fin'], W['fin'] + .7); $('end-logo').style.transform = `perspective(800px) rotateX(${{(1 - l) * 360}}deg) scale(${{.6 + .4 * l}})` }}
"""

cues = [['typing', 0.1, .1, 14], ['impact', W['30'] + .3, .55, 80], ['whoosh', W['tiltless'] - .45, .9, .45], ['thud', W['tiltless'] + .1, .4],
        ['pop', W['tiltless'] + .5, .35, 500], ['rise', W['tiltless'] + .6, 1.0, .35], ['ping', W['primer'], .2],
        ['whoosh', W['cada'] - .3, .8, .4], ['thud', W['cada'] + .6, .3], ['thud', W['cada'] + .9, .3], ['thud', W['cada'] + 1.2, .3], ['thud', W['cada'] + 1.5, .3], ['pop', W['$332'] + .1, .3, 700],
        ['whoosh', W['también'] - .3, 1.0, .45], ['rise', W['menos de una'] + .1, .6, .35], ['impact', W['$1475'] + .15, .4, 70],
        ['whoosh', W['ahora'] - .3, .8, .4], ['impact', W['comiendo'], .35, 100], ['whoosh', W['comiendo'], .6, .3],
        ['whoosh', W['el diario'] - .2, .9, .4], ['flaps', W['registrate'] + .1, .9], ['ping', W['sin pagar'], .2],
        ['whoosh', W['después'] - .3, .8, .4], ['whoosh', W['tus operaciones'] - .1, 1.0, .35], ['whoosh', W['fin'] - .3, .6, .35], ['impact', W['fin'] + .5, .3, 55]]
save('03', page(r, body, js, heads_html, end_html, END), cues)
print('03x', round(END, 2))
