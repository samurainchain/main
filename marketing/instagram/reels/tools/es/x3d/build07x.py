# Reel 07 in 3D: a candlestick chart whose stop sheet keeps sinking, the four trades that ran past
# their stop dealt like cards, a podium where the habit takes second place, typing the stop, a red wipe.
import json
from common3d import build, page, win, crop, bar_html, h1s, save, CURSOR

r = build.Reel('07'); T = r.T
W = {k: T(k) for k in ['mover', 'solo', 'vez', 'costó', 'mes de', 'cuatro', 'cero', 'cada una', 'juntas', 'segundo', 'registra', 'tiltless', 'pasó']}
W['m280'] = T('$280', 2); W['solo2'] = T('solo esta', 2)
END = r.end() + 0.9
D, E = 'x3d/shots/byday-full.png', 'x3d/shots/entry-stop.png'

# Price path (down is a lower price) and the stop sheet levels it keeps sinking to.
C = [0, 40, 10, 80, 120, 95, 170, 215, 190, 265, 310, 285, 345, 390]
candles = ''
for i in range(1, len(C)):
    color = '#f2555a' if C[i] > C[i - 1] else '#3ecf8e'
    candles += f'<div class="cd" id="cd{i}" style="position:absolute;left:0;top:0">{bar_html(f"cb{i}", color)}</div>'

CARDS = [(638, '26 oct · 8:17 p.m.'), (738, '26 oct · 8:05 p.m.'), (2317, '13 oct · 9:05 p.m.'), (2791, '8 oct · 10:35 p.m.')]
cards = ''.join(f'<div class="card3" id="k{i}"><div class="kdate">{d}</div>{crop(f"kc{i}", D, 273, y, 520, 100, "r", 10, "position:relative")}</div>' for i, (y, d) in enumerate(CARDS))

POD = [('p1', -380, 380, '2', 'Aguantó pasado el stop', '−$280.00', True), ('p0', 0, 470, '1', 'Mala hora', '−$332.50', False), ('p2', 380, 300, '3', 'FOMO', '−$260.00', False)]
pods = ''
for id, x, h, place, name, amt, hot in POD:
    color = '#f2555a' if hot else '#3a3a3a'
    lbl = (f'<div class="plbl" id="{id}-l"><div class="pn" style="color:{"#f2555a" if hot else "#ededed"}">{place}</div>'
           f'<div class="pt">{name}</div><div class="pa" style="color:{"#f2555a" if hot else "#a0a0a0"}">{amt}</div></div>')
    pods += f'<div style="position:absolute;left:{x}px;top:0">{bar_html(id, color, lbl)}</div>'

CSS = """
  .scene .card3, .scene .card3 *, .scene .plbl, .scene .plbl *, .scene .tag3d, .scene .tag3d * { transform-style:flat }
  .card3 { position:absolute; left:0; top:0; width:540px; opacity:0 }
  .kdate { font:600 30px 'JetBrains Mono', monospace; color:#a0a0a0; margin:0 0 10px 6px }
  .plbl { position:absolute; left:-170px; width:340px; text-align:center }
  .pn { font:800 120px 'JetBrains Mono', monospace; line-height:1 } .pt { font:700 34px Inter, sans-serif; color:#ededed; margin-top:6px } .pa { font:700 44px 'JetBrains Mono', monospace; margin-top:4px }
  .typed { position:absolute; font:500 17px Inter, sans-serif; color:#ededed; white-space:pre }
  .caret { display:inline-block; width:2px; height:20px; background:#3ecf8e; vertical-align:-4px; margin-left:1px }
  .slam { position:absolute; left:0; width:1080px; text-align:center; font:700 250px 'JetBrains Mono', monospace; letter-spacing:-.06em; color:#f2555a; text-shadow:0 0 60px #f2555a88 }
  .slam .c1, .slam .c2 { position:absolute; inset:0; mix-blend-mode:screen; opacity:0 } .slam .c1 { color:#00e5ff } .slam .c2 { color:#ff2bd6 }
"""

body = f"""<style>{CSS}</style>
<div id="s0" class="layer stage3d" style="opacity:1;perspective:1300px;perspective-origin:540px 860px">
  <div class="scene" id="sc0f"><div class="gridfloor" style="left:-1600px;top:-400px;width:3200px;height:1600px;opacity:.5;transform:translateZ(-160px)"></div></div>
  <div class="scene" id="sc0">
    {candles}
    <div id="sheet" style="position:absolute;left:-720px;top:0;width:1440px;height:8px;border-radius:4px;background:repeating-linear-gradient(90deg,#f2555a 0 34px,transparent 34px 54px);box-shadow:0 0 30px #f2555a;filter:drop-shadow(0 0 12px #f2555a)"></div>
    <div id="sheetzone" style="position:absolute;left:-720px;top:0;width:1440px;height:110px;background:linear-gradient(180deg,#f2555a26,#f2555a00)"></div>
    <div id="stoplbl" style="position:absolute;left:400px;top:0;font:700 44px 'JetBrains Mono', monospace;color:#f2555a;text-shadow:0 0 20px #f2555a">STOP</div>
  </div>
  <div class="slam" id="slam" style="top:1060px;opacity:0">−$280<span class="c1">−$280</span><span class="c2">−$280</span></div>
</div>

<div id="s1" class="layer stage3d" style="perspective:1300px;perspective-origin:540px 860px">
  <div class="scene" id="sc1f">
    <div style="position:absolute;left:-1600px;top:-1600px;width:3200px;height:3200px;transform:translateY(10px) rotateX(90deg);background-image:radial-gradient(closest-side,#12121200 35%,#121212 100%),linear-gradient(#3ecf8e30 2px, transparent 2px),linear-gradient(90deg, #3ecf8e30 2px, transparent 2px);background-size:100% 100%,100px 100px,100px 100px"></div>
  </div>
  <div class="scene" id="sc1">
    {cards}
    {pods}
    <div class="tag3d r" id="cost" style="left:-300px;top:-170px;width:600px;text-align:center;opacity:0;font-size:96px"><span style="display:block;font-size:36px;margin:0 0 6px">Aguantó pasado el stop · costo</span>−$280.00</div>
  </div>
</div>

<div id="s2" class="layer stage3d" style="perspective:1400px;perspective-origin:540px 900px"><div style="position:absolute;left:0;right:0;top:0;height:640px;background:linear-gradient(#121212f2 55%,#12121200);z-index:2"></div>
  <div class="scene" id="sc2">
    {win('w2', '#/trades', E, '<div class="typed" id="typed" style="left:472px;top:' + str(44 + 462 + 10) + 'px"></div>' + CURSOR.format(id='cur') + '<div class="ripple" id="rip"></div>')}
    <div class="card3" id="pop" style="opacity:0">{crop('popc', D, 273, 638, 520, 100, 'r', 10, 'position:relative')}</div>
  </div>
</div>

<div id="wipe" style="position:absolute;left:-100px;width:1280px;height:2600px;top:-2700px;background:linear-gradient(180deg,#f2555a00,#f2555a22 70%,#f2555a);border-bottom:8px solid #f2555a;box-shadow:0 0 120px #f2555a;pointer-events:none;z-index:20"></div>
"""

heads_html = h1s([
    'Mover tu stop<br><span class="r">“solo esta vez”</span>', 'Mes de demostración.<br>4 operaciones pasaron el stop.', 'Cero ganadoras.<br><span class="r">−$280.</span>',
    'Cada una se sintió<br>como una excepción.', 'Juntas: el <span class="r">segundo hábito</span><br>más caro del mes.', 'Registra tu stop.',
    'Tiltless marca cada<br>operación <span class="r">que lo pasó.</span>'])

end_html = build.end_card('“Solo esta vez”<br><span class="r">tiene precio.</span>', 'El diario es gratis · Pro 30 días gratis')

js = f"""
const W = {json.dumps(W)}
const C = {json.dumps(C)}
const POD = {json.dumps([[id, h, k] for k, (id, x, h, *_r) in enumerate(sorted(POD, key=lambda p: -p[2]))])}
labels(t, [[0, ''], [W['mes de'] - .1, '<b>Aguantó pasado el stop</b> · demo'], [W['juntas'] - .1, '<b>Costo de los errores</b> · demo'], [W['registra'] - .1, '<b>Nueva operación</b> · escritorio'], [W['solo2'] - .1, '']])
heads(t, [[.4, 'hd0'], [W['mes de'] - .1, 'hd1'], [W['cero'], 'hd2'], [W['cada una'] - .1, 'hd3'], [W['juntas'], 'hd4'], [W['registra'] - .1, 'hd5'], [W['tiltless'], 'hd6'], [W['solo2'] - .1, null]])
$('flash').style.opacity = flashAt(t, [[W['costó'] + .55, .22], [W['m280'] + .15, .15], [W['segundo'] + .2, .15]])

// A falling chart; each time price reaches the stop sheet, the sheet sinks "just this once".
if (show('s0', t, 0, W['mes de'] - .05, .2)) {{
  const c = track([[0, {{ x: -200, y: 170, z: -150, rx: -12, ry: 30, rz: 0 }}], [W['costó'], {{ x: 80, y: 260, z: -120, rx: -10, ry: -8, rz: 0 }}], [W['mes de'], {{ x: 200, y: 300, z: -60, rx: -8, ry: -20, rz: 0 }}]], t)
  const drops = [W['stop'] = {T('stop')}, W['solo'] + .1, W['vez'] + .05]
  const levels = [100, 200, 300, 420]; let lv = levels[0]
  drops.forEach((d, i) => {{ lv = lerp(lv, levels[i + 1], easeOutBounce(clamp((t - d) / .45))) }})
  const [sx, sy] = drops.reduce((acc, d) => {{ const s = shake(t, d + .3, .25, 12); return [acc[0] + s[0], acc[1] + s[1]] }}, [0, 0])
  $('sc0').style.transform = $('sc0f').style.transform = `translate(${{sx}}px, ${{sy}}px) ` + camCss(c)
  $('sheet').style.transform = `translateY(${{lv}}px) translateZ(40px)`; $('sheetzone').style.transform = `translateY(${{lv + 4}}px) translateZ(-30px)`; $('stoplbl').style.transform = `translateY(${{lv - 58}}px) translateZ(40px)`
  const shown = Math.min(C.length - 1, Math.floor(1 + clamp((t - .15) / (W['costó'] - .3)) * (C.length - 1)))
  for (let i = 1; i < C.length; i++) {{
    const p = easeOutBack(clamp((t - .15 - (i - 1) * (W['costó'] - .3) / (C.length - 1)) / .25))
    const top = Math.min(C[i], C[i - 1]), h = Math.max(10, Math.abs(C[i] - C[i - 1])) * p
    $('cd' + i).style.opacity = p > 0 ? 1 : 0; $('cd' + i).style.transform = `translate3d(${{-650 + i * 95}}px, ${{top + h}}px, 0)`; bar('cb' + i, h, 56, 56)
  }}
  const at = W['costó'] + .2, p = clamp((t - at) / .28), el = $('slam')
  el.style.opacity = clamp(p * 3); el.style.transform = `perspective(900px) translateZ(${{(1 - easeOutBack(p)) * 900}}px)`; el.style.filter = `blur(${{(1 - p) * 16}}px)`
  const g = t > at + .22 && t < at + .55 ? 1 : 0, j = Math.sin(t * 140) * 14
  el.querySelector('.c1').style.opacity = g * .9; el.querySelector('.c1').style.transform = `translate(${{-10 + j}}px, 2px)`; el.querySelector('.c2').style.opacity = g * .9; el.querySelector('.c2').style.transform = `translate(${{10 - j}}px, -2px)`
  const out = clamp((t - (W['mes de'] - .45)) / .4); $('s0').style.filter = out > 0 ? `blur(${{out * 14}}px)` : 'none'
}}

// The four trades dealt onto the table, then stacked onto the podium's second step.
if (show('s1', t, W['mes de'] - .1, W['registra'] - .05, .2)) {{
  const c = track([
    [W['mes de'] - .1, {{ x: 0, y: -60, w: 0, z: -1100, rx: -80, ry: 0, rz: -20 }}],
    [W['mes de'] + .8, {{ x: 0, y: -40, w: 0, z: -260, rx: -74, ry: 0, rz: -4 }}, 'expo'],
    [W['cada una'], {{ x: 0, y: -40, w: 0, z: -220, rx: -70, ry: 4, rz: -2 }}],
    [W['juntas'] - .45, {{ x: 0, y: -40, w: 0, z: -240, rx: -68, ry: 2, rz: -2 }}],
    [W['juntas'], {{ x: 0, y: -330, w: 0, z: -620, rx: -16, ry: 20, rz: 0 }}],
    [W['registra'], {{ x: -120, y: -380, w: 0, z: -560, rx: -12, ry: -10, rz: 0 }}],
  ], t)
  $('sc1').style.transform = $('sc1f').style.transform = camCss(c)
  const slots = [[-20, -390, -3], [25, -130, 2], [-15, 130, -2], [20, 390, 3]]
  const stack = ease(clamp((t - W['cada una'] - .3) / 1.0)), onPod = ease(clamp((t - W['segundo'] + .1) / .6))
  ;[0, 1, 2, 3].forEach((i) => {{
    const at = W['cuatro'] + i * .4, p = clamp((t - at) / .45), e = easeOutBack(p)
    const [sx, sz, sr] = slots[i]
    let x = lerp(900, sx, e), z = lerp(-900, sz, e), y = lerp(-500, -2, ease(p)), rot = lerp(160, sr, e)
    x = lerp(x, 0, stack); z = lerp(z, 0, stack); y = lerp(y, -2 - i * 8, stack); rot = lerp(rot, i * 3 - 4, stack)
    const lift = ease(clamp((t - W['juntas'] + .45) / .45))
    x = lerp(x, -380, lift); y = lerp(y, -720 - i * 8, lift); z = lerp(z, 0, lift)
    y = lerp(y, -380 - 4 - i * 8, onPod)
    const el = $('k' + i), gone = clamp((t - W['juntas'] + .1) / .35); el.style.opacity = p > 0 ? 1 - gone : 0; el.style.display = gone >= 1 ? 'none' : 'block'
    el.style.transform = `translate3d(${{x - 270}}px, ${{y}}px, ${{z}}px) rotateX(90deg) rotateZ(${{rot}}deg) translate(0, -70px) scale(${{1.12 - ease(clamp((t - W['juntas'] + .45) / .45)) * .7}})`
  }})
  const cp = easeOutBack(clamp((t - W['m280'] + .05) / .5)); $('cost').style.opacity = clamp(cp * 3) * (1 - clamp((t - W['cada una']) / .3))
  $('cost').style.transform = `translateY(${{-cp * 240}}px) translateZ(${{40}}px) rotateX(${{-c.rx * .8}}deg)`
  POD.forEach(([id, h, k]) => {{ const p = easeOutBack(clamp((t - W['juntas'] - k * .25) / .6)); const hh = Math.max(.01, h * p); bar(id, hh, 340, 300); $(id).parentElement.style.opacity = p > 0 ? 1 : 0
    const l = $(id + '-l'); l.style.top = (-hh - 370) + 'px'; l.style.opacity = clamp(p * 2); l.style.transform = `translateZ(160px)` }})
  const hot = clamp((t - W['segundo']) / .3); $('p1').children[0].style.boxShadow = `0 0 ${{40 + hot * 80}}px #f2555a${{hot > .5 ? 'cc' : '55'}}`
}}

// Typing the stop into the desktop entry form; then a trade that ran past its stop is flagged.
if (show('s2', t, W['registra'] - .1, W['solo2'] - .05, .2)) {{
  const fy = 44 + 462 + 20
  const c = track([
    [W['registra'] - .1, {{ x: 720, y: 472, z: -1300, rx: -30, ry: 40, rz: 4 }}],
    [W['registra'] + .7, {{ x: 720, y: fy, z: 640, rx: 6, ry: -8, rz: 0 }}, 'expo'],
    [W['tiltless'], {{ x: 720, y: fy, z: 700, rx: 8, ry: -4, rz: 0 }}],
    [W['tiltless'] + .6, {{ x: 720, y: 472, z: -420, rx: 10, ry: 12, rz: 0 }}],
    [W['solo2'], {{ x: 720, y: 472, z: -380, rx: 12, ry: 16, rz: 0 }}],
  ], t)
  $('sc2').style.transform = camCss(c)
  const click = W['registra'] + .5, k = $('cur'); k.style.left = lerp(1100, 700, ease(clamp((t - W['registra']) / .45))) + 'px'; k.style.top = lerp(800, fy - 6, ease(clamp((t - W['registra']) / .45))) + 'px'
  k.style.opacity = clamp((t - W['registra']) / .15) * (1 - clamp((t - click - .3) / .2)); k.style.transform = `scale(${{t > click && t < click + .12 ? .85 : 1}})`
  const rp = clamp((t - click) / .5); $('rip').style.left = '700px'; $('rip').style.top = fy + 'px'; $('rip').style.opacity = t > click ? 1 - rp : 0; $('rip').style.transform = `scale(${{.3 + rp}})`
  const txt = '66,300', n = Math.floor(clamp((t - click - .15) / .7) * txt.length + .001)
  $('typed').innerHTML = (t > click ? txt.slice(0, n) : '') + (t > click && Math.floor(t * 3) % 2 === 0 ? '<span class="caret"></span>' : '')
  const pp = easeOutBack(clamp((t - W['tiltless'] - .2) / .5)), el = $('pop')
  el.style.opacity = clamp(pp * 3); el.style.transform = `translate3d(${{460}}px, ${{330}}px, ${{pp * 300}}px) rotateY(${{(1 - pp) * 50}}deg) scale(1.2)`
  $('w2').style.filter = `blur(${{pp * 5}}px) brightness(${{1 - pp * .4}})`
}}

// The stop line sweeps down the screen and leaves the end card behind.
const wp = clamp((t - W['solo2'] + .35) / .6); $('wipe').style.transform = `translateY(${{ease(wp) * 4700}}px)`
if (show('end', t, W['solo2'] - .05, 999)) {{ const l = prog(t, W['solo2'], W['solo2'] + .6); $('end-logo').style.transform = `translateY(${{(1 - easeOutBounce(l)) * -300}}px)` }}
"""

cues = [['whoosh', 0.1, .5, .25], ['clunk', T('stop') + .3, .5], ['clunk', W['solo'] + .4, .5], ['clunk', W['vez'] + .35, .55], ['impact', W['costó'] + .45, .55, 70],
        ['whoosh', W['mes de'] - .45, 1.0, .5], ['deal', W['cuatro'], .5], ['deal', W['cuatro'] + .4, .5], ['deal', W['cuatro'] + .8, .5], ['deal', W['cuatro'] + 1.2, .5],
        ['pop', W['m280'] + .1, .3, 600], ['whoosh', W['cada una'] + .3, .9, .3], ['thud', W['juntas'] + .2, .4], ['thud', W['juntas'] + .45, .4], ['thud', W['juntas'] + .7, .4],
        ['impact', W['segundo'] + .3, .35, 80], ['whoosh', W['registra'] - .3, .8, .4], ['click', W['registra'] + .5, .5], ['typing', W['registra'] + .68, .12, 6],
        ['pop', W['tiltless'] + .3, .3, 800], ['laser', W['solo2'] - .35, .6], ['impact', W['solo2'] + .2, .3, 55]]
save('07', page(r, body, js, heads_html, end_html, END), cues)
print('07x', round(END, 2))
