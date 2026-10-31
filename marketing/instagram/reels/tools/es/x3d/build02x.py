# Reel 02 in 3D: dropping words and a flipping stopwatch, an overhead crane onto the desktop
# analytics, then hold-time towers rising from a grid floor; the quick ones eat the patient one.
import json
from common3d import build, page, win, crop, ext, bar_html, h1s, save

r = build.Reel('02'); T = r.T
W = {k: T(k) for k in ['deja', 'esto es', 'mes de', '52', 'arriba', 'se ve', 'ahora ordena', 'menos de 15', 'menos de una', 'de una a', 'las rápidas', 'tu tasa', 'nunca', 'encuentra']}
W['620'] = T('menos', 1) if False else T('$620'); W['1730'] = T('más')
END = r.end() + 0.9
A = 'x3d/shots/analytics-full.png'

hook_words = [('Deja', 0.55), ('de', 0.85), ('hacer', 1.0), ('<br>', 0), ('operaciones', 1.1), ('<br>', 0), ('de', 1.55), ('<span class="r">15 minutos.</span>', 1.75)]
hw = ''.join('<br>' if w == '<br>' else f'<span class="dw" id="dw{i}" style="display:inline-block;opacity:0">{w}</span> ' for i, (w, _) in enumerate(hook_words))
hw_js = ' '.join(f"drop('dw{i}', t, {a});" for i, (w, a) in enumerate(hook_words) if w != '<br>')

bars = [('b0', '#f2555a', 95, '&lt; 5 min', '−$95'), ('b1', '#f2555a', 525, '5–15 min', '−$525'), ('b2', '#f2555a', 855, '15–60 min', '−$855'), ('b3', '#3ecf8e', 1730, '1–4 horas', '+$1,730')]
XS = [-480, -160, 160, 480]
bar_divs = ''
for (id, color, v, name, amt), x in zip(bars, XS):
    lbl = (f'<div id="{id}-l" style="position:absolute;left:-150px;width:300px;text-align:center;top:0;opacity:0">'
           f'<div style="font:600 34px Inter, sans-serif;color:#a0a0a0">{name}</div><div id="{id}-a" style="font:700 52px \'JetBrains Mono\', monospace;color:{color};text-shadow:0 0 30px {color}88">{amt}</div></div>')
    bar_divs += f'<div style="position:absolute;left:{x}px;top:0;transform-style:preserve-3d">{bar_html(id, color, lbl)}</div>'

body = f"""
<div id="hook" class="layer" style="opacity:1">
  <div class="hook-h" id="hk1" style="top:250px;font-size:104px;perspective:900px">{hw}</div>
  <div class="hook-h" id="hk2" style="top:270px;font-size:104px;opacity:0">Esto es<br><span class="r">lo que cuestan.</span></div>
  <div id="dialw" style="position:absolute;inset:0;perspective:1200px;perspective-origin:540px 960px">
    <div id="dial" style="position:absolute;left:290px;top:690px;width:500px;height:500px;transform-style:preserve-3d">
      <div class="face3" style="inset:0">{build.WATCH_SVG.format(color='#f2555a').replace('class="watch"', 'style="width:500px;height:500px"')}</div>
      <div class="face3" style="inset:0;transform:rotateX(180deg);border-radius:50%;border:16px solid #f2555a;box-shadow:0 0 80px #f2555a66, inset 0 0 80px #f2555a33;display:flex;align-items:center;justify-content:center;background:#151515">
        <div id="cnt" style="font:700 120px 'JetBrains Mono', monospace;color:#f2555a;letter-spacing:-.05em;text-shadow:0 0 40px #f2555a88">−$0</div></div>
    </div></div>
</div>

<div id="s1" class="layer stage3d" style="perspective:1400px;perspective-origin:540px 900px">
  <div class="scene" id="sc1">
    {win('w1', '#/analytics', A)}
    <div id="pin1" style="position:absolute;left:342px;top:400px"><div style="position:absolute;left:-3px;top:0;width:6px;height:240px;background:linear-gradient(#3ecf8e,#3ecf8e00);transform-origin:50% 0;transform:rotateX(-90deg)"></div>
      <div class="tag3d g" id="pin1t" style="left:-130px;top:-60px;transform:translateZ(240px)">52%<span style="margin:0 0 0 18px;font-size:32px">acierto</span></div></div>
    <div id="pin2" style="position:absolute;left:470px;top:318px"><div style="position:absolute;left:-3px;top:0;width:6px;height:380px;background:linear-gradient(#3ecf8e,#3ecf8e00);transform-origin:50% 0;transform:rotateX(-90deg)"></div>
      <div class="tag3d g" id="pin2t" style="left:-140px;top:-60px;transform:translateZ(380px)">+$255</div></div>
  </div>
</div>

<div id="s2" class="layer stage3d" style="perspective:1500px;perspective-origin:540px 860px">
  <div class="scene" id="sc2f">
    <div id="brk" style="position:absolute;left:-620px;top:0;width:0;height:300px;transform:rotateX(90deg);transform-origin:0 0;border-radius:20px;background:#f2555a22;border:4px solid #f2555a;box-shadow:0 0 60px #f2555a88;opacity:0"></div>
    <div id="fl2" style="position:absolute;left:-1600px;top:-1600px;width:3200px;height:3200px;transform:translateY(6px) rotateX(90deg);background-image:radial-gradient(closest-side,#12121200 35%,#121212 100%),linear-gradient(#3ecf8e30 2px, transparent 2px),linear-gradient(90deg, #3ecf8e30 2px, transparent 2px);background-size:100% 100%,100px 100px,100px 100px"></div>
  </div>
  <div class="scene" id="sc2">
    <div id="board" style="position:absolute;left:0;top:0">{crop('holdc', A, 846, 3171, 562, 333, '', 12)}</div>
    {bar_divs}
    <div class="tag3d r" id="bt" style="left:-540px;top:-700px;opacity:0;font-size:46px"><span id="btn">&lt; 15 min · 4 operaciones</span><b id="bta">−$620</b></div>
  </div>
</div>

<div id="s3" class="layer" style="perspective:1300px;perspective-origin:540px 860px">
  <div id="wr3" style="position:absolute;inset:0;transform-style:preserve-3d">
    <div id="half1" style="position:absolute;inset:0;transform-style:preserve-3d;clip-path:polygon(0 0,100% 0,100% 42%,0 52%)">{ext('x1', '52%', '#ededed', 640, '', 330, 20)}</div>
    <div id="half2" style="position:absolute;inset:0;transform-style:preserve-3d;clip-path:polygon(0 52%,100% 42%,100% 100%,0 100%)">{ext('x2', '52%', '#ededed', 640, '', 330, 20)}</div>
    <div id="laser" style="position:absolute;left:-100px;width:1280px;top:880px;height:12px;border-radius:6px;background:#f2555a;box-shadow:0 0 30px #f2555a,0 0 80px #f2555a;transform:rotate(-5.3deg);clip-path:inset(0 100% 0 0)"></div>
  </div>
</div>
"""

heads_html = h1s([
    'Mes de demostración.<br><span class="g">52% de acierto.</span>', 'Arriba <span class="g">$255.</span><br>Se ve bien, ¿no?',
    'Ahora ordénalas por<br><span class="g">tiempo en posición.</span>', 'Menos de 15 min:<br><span class="r">4 operaciones, −$620.</span>',
    'Menos de una hora:<br><span class="r">11 operaciones. 0 ganadoras.</span>', 'De una a cuatro horas:<br><span class="g">+$1,730.</span>',
    'Las rápidas se comieron<br>casi todo lo que ganaron<br><span class="g">las pacientes.</span>', 'Tu tasa de acierto<br><span class="r">nunca te va a enseñar</span><br>eso.'])

end_html = build.end_card('Encuentra tus<br><span class="r">operaciones de 15 minutos.</span>', build.PRO_SMALL).replace(
    '<img class="logo"', '<div id="rings" style="position:absolute;left:540px;top:460px;width:0;height:0">' + ''.join(
        f'<div class="ring" style="position:absolute;left:-150px;top:-150px;width:300px;height:300px;border-radius:50%;border:4px solid #3ecf8e;opacity:0"></div>' for _ in range(3)) + '</div><img class="logo"')

js = f"""
const W = {json.dumps(W)}
function drop(id, t, at) {{ const p = clamp((t - at) / .5), e = easeOutBounce(p); const el = $(id); el.style.opacity = clamp(p * 4); el.style.transform = `translateY(${{(1 - e) * -260}}px) rotateX(${{(1 - clamp(p * 1.6)) * 90}}deg)` }}
labels(t, [[W['mes de'] - .1, '<b>Análisis</b> · demo · escritorio'], [W['ahora ordena'] - .1, '<b>PnL por tiempo en posición</b> · demo'], [W['tu tasa'] - .1, '<b>Tasa de acierto</b> · demo'], [W['encuentra'] - .1, '']])
heads(t, [[W['mes de'] - .1, 'hd0'], [W['arriba'], 'hd1'], [W['ahora ordena'] - .1, 'hd2'], [W['menos de 15'], 'hd3'], [W['menos de una'], 'hd4'], [W['de una a'], 'hd5'], [W['las rápidas'] - .1, 'hd6'], [W['tu tasa'] - .1, 'hd7'], [W['encuentra'] - .1, null]])
$('flash').style.opacity = flashAt(t, [[W['esto es'] + .5, .2], [W['1730'] + .1, .2], [W['nunca'] + .3, .25], [W['mes de'] - .15, .15]])

// Hook: words drop in with a bounce, the stopwatch fills to 15:00, flips over and shows what it cost.
if (show('hook', t, 0, W['mes de'] - .1, .15)) {{
  {hw_js}
  swap(['hk1', 'hk2'], t, [0, W['esto es']])
  watch(t, .3, 1.9); $('mm').textContent = Math.round(15 * prog(t, .3, 1.9)) + ':00'
  const flip = easeOutBack(clamp((t - W['esto es'] - .05) / .6)), [sx, sy] = shake(t, W['esto es'] + .5)
  const away = clamp((t - (W['mes de'] - .5)) / .4)
  $('dial').style.transform = `translate(${{sx}}px, ${{sy}}px) translateZ(${{away * 900}}px) rotateX(${{flip * 180 + Math.sin(t * 1.4) * 8}}deg) rotateY(${{Math.sin(t * 1.1) * 14}}deg)`
  // Fade the wrapper: opacity on the turning dial itself would flatten it and show its back.
  $('dialw').style.opacity = 1 - away
  $('cnt').textContent = '−$' + Math.round(620 * prog(t, W['esto es'] + .3, W['esto es'] + 1.3))
}}

// Desktop analytics seen from above, then the crane comes down; pins rise from the numbers.
if (show('s1', t, W['mes de'] - .2, W['ahora ordena'] + .1, .15)) {{
  const c = track([
    [W['mes de'] - .2, {{ x: 720, y: 470, z: -2600, rx: 72, ry: 0, rz: -25 }}],
    [W['mes de'] + 1.2, {{ x: 470, y: 420, z: -420, rx: 48, ry: 0, rz: -8 }}, 'expo'],
    [W['se ve'], {{ x: 440, y: 400, z: -250, rx: 40, ry: 8, rz: -4 }}],
    [W['ahora ordena'] + .1, {{ x: 440, y: 400, z: 900, rx: 80, ry: 0, rz: 0 }}],
  ], t)
  $('sc1').style.transform = camCss(c)
  const pin = (id, at, hgt) => {{ const p = easeOutBack(clamp((t - at) / .5)); $(id).style.opacity = clamp(p * 3); $(id + 't').style.transform = `translateZ(${{p * hgt}}px) rotateX(-60deg)` }}
  pin('pin1', W['52'], 240); pin('pin2', W['arriba'] + .2, 380)
  const sw = prog(t, W['mes de'] + .6, W['mes de'] + 1.8); $('w1-sweep').style.opacity = sw > 0 && sw < 1 ? 1 : 0; $('w1-sweep').style.transform = `translateX(${{-1600 + sw * 3200}}px)`
}}

// Hold-time towers on a grid floor; the camera orbits as they rise.
if (show('s2', t, W['ahora ordena'] - .05, W['tu tasa'] - .05, .2)) {{
  const c = track([
    [W['ahora ordena'], {{ x: 0, y: -260, w: -300, z: -900, rx: -38, ry: 30, rz: 0 }}],
    [W['menos de 15'], {{ x: -200, y: -200, w: 0, z: -500, rx: -22, ry: 16, rz: 0 }}],
    [W['menos de una'], {{ x: -120, y: -230, w: 0, z: -520, rx: -20, ry: 6, rz: 0 }}],
    [W['de una a'] + .2, {{ x: 120, y: -330, w: 0, z: -560, rx: -14, ry: -10, rz: 0 }}],
    [W['las rápidas'], {{ x: 160, y: -380, w: 0, z: -620, rx: -12, ry: -18, rz: 0 }}],
    [W['tu tasa'], {{ x: 300, y: -200, w: 0, z: -420, rx: -24, ry: -28, rz: 0 }}],
  ], t)
  $('sc2').style.transform = $('sc2f').style.transform = camCss(c)
  $('board').style.transform = `translate3d(-293px, -760px, -620px) scale(1.05)`; $('board').style.opacity = 1 - prog(t, W['menos de 15'] - .3, W['menos de 15'] + .3) * .65
  const H = (v) => v / 1730 * 640
  const eat = prog(t, W['las rápidas'] + .3, W['las rápidas'] + 2.0)
  const rise = (i, at, v) => {{
    const id = 'b' + i, p = easeOutBack(clamp((t - at) / .7))
    let h = Math.max(.01, H(v) * p); if (i < 3) h *= 1 - eat; else h = Math.max(.01, lerp(H(1730), H(255), eat) * clamp(p))
    bar(id, h, 220, 220)
    const holder = $(id).parentElement; holder.style.opacity = t > at ? 1 : 0; holder.style.transform = i < 3 ? `translateX(${{eat * (480 - [-480, -160, 160][i])}}px)` : ''
    const l = $(id + '-l'); l.style.top = (-h - 150) + 'px'; l.style.opacity = clamp(p * 2) * (i < 3 ? 1 - eat : 1); l.style.transform = `rotateY(${{-c.ry}}deg) rotateX(${{-c.rx * .6}}deg)`
  }}
  rise(0, W['menos de 15'] + .1, 95); rise(1, W['menos de 15'] + .3, 525); rise(2, W['menos de una'] + .2, 855); rise(3, W['de una a'] + .2, 1730)
  if (eat > 0) $('b3-a').textContent = '+$' + Math.round(lerp(1730, 255, eat)).toLocaleString('en-US')
  const bk = t < W['menos de una'] ? prog(t, W['menos de 15'] + .4, W['menos de 15'] + .9) * 720 : 720 + prog(t, W['menos de una'] + .3, W['menos de una'] + .8) * 320
  $('brk').style.width = bk + 'px'; $('brk').style.opacity = clamp(bk / 100) * (1 - prog(t, W['de una a'], W['de una a'] + .4)); $('brk').style.top = '-3px'; $('brk').style.display = parseFloat($('brk').style.opacity) > 0 ? 'block' : 'none'
  const btp = easeOutBack(clamp((t - W['620']) / .5)); $('bt').style.opacity = clamp(btp * 3) * (1 - prog(t, W['de una a'], W['de una a'] + .3))
  $('bt').style.transform = `translateZ(${{80 + btp * 160}}px) rotateY(${{-c.ry}}deg)`
  if (t > W['menos de una']) {{ $('btn').textContent = '< 1 hora · 11 operaciones'; $('bta').textContent = '0 ganadoras' }} else {{ $('btn').textContent = '< 15 min · 4 operaciones'; $('bta').textContent = '−$620' }}
}}

// The win rate gets sliced in two.
if (show('s3', t, W['tu tasa'] - .1, W['encuentra'] - .05, .2)) {{
  const p = easeOutBack(clamp((t - W['tu tasa']) / .6))
  $('x1').style.opacity = $('x2').style.opacity = clamp(p * 3)
  $('wr3').style.transform = `translateZ(${{(1 - p) * -600}}px) rotateY(${{Math.sin(t * .8) * 18}}deg) rotateX(8deg)`
  $('laser').style.clipPath = `inset(0 ${{(1 - prog(t, W['nunca'], W['nunca'] + .35)) * 100}}% 0 0)`
  const s = easeOutExpo(clamp((t - W['nunca'] - .35) / .8))
  $('half1').style.transform = `translate3d(${{-s * 40}}px, ${{-s * 70}}px, 0) rotateZ(${{-s * 4}}deg)`; $('half2').style.transform = `translate3d(${{s * 40}}px, ${{s * 70}}px, 0) rotateZ(${{s * 4}}deg)`
  $('laser').style.opacity = 1 - prog(t, W['nunca'] + .5, W['nunca'] + 1)
}}

if (show('end', t, W['encuentra'] - .05, 999)) {{
  const l = prog(t, W['encuentra'], W['encuentra'] + .6); $('end-logo').style.transform = `scale(${{.6 + .4 * easeOutBack(l)}})`
  document.querySelectorAll('.ring').forEach((el, i) => {{ const q = clamp((t - W['encuentra'] - i * .18) / 1.1); el.style.opacity = q > 0 ? (1 - q) * .9 : 0; el.style.transform = `scale(${{.6 + q * 2.6}})` }})
}}
"""

cues = [['whoosh', 0.35, .5, .25], ['tick', 0.3, 1.6], ['impact', W['esto es'] + .45, .55, 70], ['whoosh', W['esto es'] - .1, .6, .35],
        ['whoosh', W['mes de'] - .45, 1.0, .5], ['pop', W['52'] + .15, .25, 700], ['pop', W['arriba'] + .35, .25, 900],
        ['whoosh', W['ahora ordena'] - .3, .9, .45], ['thud', W['menos de 15'] + .3, .35], ['thud', W['menos de 15'] + .5, .35],
        ['thud', W['menos de una'] + .4, .4], ['rise', W['de una a'] + .2, .8, .4], ['impact', W['1730'] + .1, .4, 90],
        ['whoosh', W['las rápidas'] + .2, 1.6, .3], ['whoosh', W['tu tasa'] - .4, .7, .4], ['laser', W['nunca'], .35], ['impact', W['nunca'] + .35, .4, 60],
        ['whoosh', W['encuentra'] - .3, .7, .4], ['impact', W['encuentra'] + .1, .3, 55]]
save('02', page(r, body, js, heads_html, end_html, END), cues)
print('02x', round(END, 2))
