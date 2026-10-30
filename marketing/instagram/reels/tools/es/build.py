# Builds the Spanish voiced reels: one HTML stage per reel, timed to its voiceover.
# Usage: python3 build.py 03 02 04 06 07
import json, re, sys

BASE = re.sub(r'</?style>|</head>', '', open('base.css').read())
S = 800 / 358  # app screenshot width 358 px -> 800 px on the stage

EXTRA = """
  .card { max-height:800px }
  .card img { transition:none }
  .hook-h.sm { font-size:84px }
  .sub { position:absolute; left:90px; width:900px; top:1352px; text-align:center; opacity:0 }
  .sub span.box { display:inline-block; padding:12px 30px 16px; border-radius:26px; background:#0b0d0ccc; border:2px solid #ffffff14; font-size:54px; font-weight:800; letter-spacing:-.015em; line-height:1.15; white-space:nowrap }
  .sub i { font-style:normal; color:#ededed }
  .sub i.on { color:var(--green); text-shadow:0 0 24px #3ecf8e99 }
  .sub i.red.on { color:var(--red); text-shadow:0 0 24px #f2555a99 }
  .watch { position:absolute; left:340px; top:640px; width:400px; height:400px }
  .counter { position:absolute; left:140px; width:800px; top:1060px; text-align:center; font-family:'JetBrains Mono', monospace; font-weight:700; font-size:150px; color:var(--red); letter-spacing:-.05em; text-shadow:0 0 50px #f2555a66 }
  .counter.g { color:var(--green); text-shadow:0 0 50px #3ecf8e66 }
  .duo { position:absolute; left:140px; width:800px; top:700px }
  .duo .row { display:flex; justify-content:space-between; align-items:baseline; padding:36px 0; border-bottom:2px solid var(--border); opacity:0 }
  .duo .row span { font-size:60px; font-weight:700 }
  .duo .row b { font-family:'JetBrains Mono', monospace; font-size:96px; letter-spacing:-.04em }
  .trow { position:absolute; left:140px; width:800px; border-radius:32px; border:2px solid var(--border); background:#171717; padding:34px 40px }
  .trow .top { display:flex; justify-content:space-between; align-items:baseline; gap:24px; font-size:46px; font-weight:700; white-space:nowrap }
  .trow .top b { font-family:'JetBrains Mono', monospace; color:var(--red); font-size:44px }
  .trow .meta { font-size:34px; color:var(--muted); margin-top:8px }
  .flag { display:inline-block; margin-top:22px; padding:10px 22px; border-radius:16px; border:2px solid var(--red); color:var(--red); font-size:34px; font-weight:600; background:#f2555a14; box-shadow:0 0 34px #f2555a44; opacity:0 }
  .chips { position:absolute; left:140px; width:800px; top:640px; display:flex; flex-wrap:wrap; gap:22px }
  .chip { padding:20px 34px; border-radius:999px; border:2px solid var(--border); font-size:46px; font-weight:600; color:var(--muted); background:#171717 }
  .chip.on { border-color:var(--red); color:var(--red); box-shadow:0 0 40px #f2555a55 }
  .chip.calm.on { border-color:var(--green); color:var(--green); box-shadow:0 0 40px #3ecf8e55 }
  .chart { position:absolute; left:140px; top:640px; width:800px; height:440px }
"""

JS_HELPERS = """
const $ = (id) => document.getElementById(id)
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const ease = (x) => { x = clamp(x); return x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2 }
const prog = (t, a, b) => ease((t - a) / (b - a))
function show(id, t, a, b, f = .2) { const o = Math.min(a <= 0 ? 1 : clamp((t - a) / f), clamp((b - t) / f)); $(id).style.opacity = o; return o }
function swap(ids, t, times) { ids.forEach((id, i) => { const a = times[i], b = times[i + 1] ?? 999; $(id).style.opacity = Math.min(i === 0 ? 1 : clamp((t - a) / .15), clamp((b - t) / .15)) }) }
const S = 800 / 358
function box(id, o, [x, y, w, h]) { const el = $(id); el.style.opacity = o; el.style.left = (x * S - 10) + 'px'; el.style.top = (y * S - 8) + 'px'; el.style.width = (w * S + 20) + 'px'; el.style.height = (h * S + 16) + 'px' }
const slide = (id, t, a) => { const p = prog(t, a, a + .35); $(id).style.opacity = p; $(id).style.transform = `translateX(${(1 - p) * 60}px)` }
function watch(t, a, b, minutes = 15) {
  const p = prog(t, a, b), ang = p * 2 * Math.PI, r = 160, cx = 200, cy = 215
  const x = cx + r * Math.sin(ang), y = cy - r * Math.cos(ang)
  $('arc').setAttribute('d', p >= .999 ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - .01} ${cy - r}` : `M ${cx} ${cy - r} A ${r} ${r} 0 ${ang > Math.PI ? 1 : 0} 1 ${x} ${y}`)
  $('mm').textContent = `${Math.floor(minutes * p)}:${String(Math.floor((minutes * p * 60) % 60)).padStart(2, '0')}`
}
let shown = -1
function subtitles(t) {
  let k = -1
  for (let i = 0; i < CHUNKS.length; i++) {
    const c = CHUNKS[i], next = CHUNKS[i + 1]
    const end = next ? Math.min(next[0].s - .02, c[c.length - 1].e + .6) : c[c.length - 1].e + .8
    if (t >= c[0].s - .06 && t < end) k = i
  }
  $('sub').style.opacity = k < 0 ? 0 : 1
  if (k < 0) return
  if (k !== shown) { $('subbox').innerHTML = CHUNKS[k].map((w) => `<i class="${w.c}">${w.w}</i>`).join(' '); shown = k }
  const items = $('subbox').querySelectorAll('i')
  CHUNKS[k].forEach((w, j) => items[j].classList.toggle('on', t >= w.s - .03 && t < (CHUNKS[k][j + 1] ? CHUNKS[k][j + 1].s - .03 : w.e + .5)))
}
"""

WATCH_SVG = """<svg class="watch" viewBox="0 0 400 400"><circle cx="200" cy="215" r="160" fill="none" stroke="#2e2e2e" stroke-width="16"/>
<path id="arc" fill="none" stroke="{color}" stroke-width="16" stroke-linecap="round" style="filter:drop-shadow(0 0 14px {color})"/>
<rect x="175" y="18" width="50" height="26" rx="8" fill="#a0a0a0"/>
<text id="mm" x="200" y="245" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="92" font-weight="700" fill="#ededed">0:00</text></svg>"""


def tokens(words):
    """Subtitle tokens: amounts joined with their sign word, fixes for the recognizer's spelling."""
    fix = {'fomo,': 'FOMO,', 'fomo': 'FOMO', 'pro': 'Pro', 'registrate': 'Regístrate', 'hábitos': 'hábito', '$1475': '$1,475'}
    out, i = [], 0
    W = [dict(w) for w in words]
    while i < len(W):
        w = W[i]
        if w['w'] == '$1' and i + 1 < len(W) and W[i + 1]['w'].startswith(','):
            w = {'w': '$1' + W[i + 1]['w'], 's': w['s'], 'e': W[i + 1]['e']}; W[i + 1:i + 2] = []
        w['w'] = fix.get(w['w'], w['w'])
        nxt = W[i + 1] if i + 1 < len(W) else None
        if w['w'].lower() in ('menos', 'más') and nxt and nxt['w'].startswith('$'):
            amount = fix.get(nxt['w'], nxt['w'])
            if amount == '$1' and i + 2 < len(W) and W[i + 2]['w'].startswith(','):
                amount = '$1' + W[i + 2]['w']; W[i + 2:i + 3] = []
            j, end, punct = i + 2, nxt['e'], ''
            if j < len(W) and W[j]['w'].startswith('dólares'):
                punct = W[j]['w'][len('dólares'):]; end = W[j]['e']; j += 1
            sign = '−' if w['w'].lower() == 'menos' else '+'
            out.append({'w': sign + amount + punct, 's': w['s'], 'e': end, 'c': 'red' if sign == '−' else ''}); i = j; continue
        if w['w'].startswith('$'):
            j, end, punct = i + 1, w['e'], ''
            if j < len(W) and W[j]['w'].startswith('dólares'):
                punct = W[j]['w'][len('dólares'):]; end = W[j]['e']; j += 1
            out.append({'w': w['w'] + punct, 's': w['s'], 'e': end, 'c': ''}); i = j; continue
        if nxt and nxt['w'].startswith('%'):
            out.append({'w': w['w'] + nxt['w'], 's': w['s'], 'e': nxt['e'], 'c': ''}); i += 2; continue
        out.append({'w': w['w'], 's': w['s'], 'e': w['e'], 'c': ''}); i += 1
    return out


def chunks(toks, most=4):
    """Sentences split into balanced chunks of at most `most` words."""
    sentences, cur = [], []
    for t in toks:
        cur.append(t)
        if re.search(r'[.,?!:]$', t['w']):
            sentences.append(cur); cur = []
    if cur: sentences.append(cur)
    out = []
    for s in sentences:
        parts = -(-len(s) // most)
        size = -(-len(s) // parts)
        out += [s[k:k + size] for k in range(0, len(s), size)]
    return out


class Reel:
    def __init__(self, n):
        self.n = n
        self.words = json.load(open(f'words-{n}.json'))
        self.toks = tokens(self.words)
        self.layers, self.js = [], []

    def T(self, phrase, occurrence=1):
        parts = phrase.lower().split()
        ws = [re.sub(r'[^\wáéíóúñü$%]', '', w['w'].lower()) for w in self.words]
        seen = 0
        for i in range(len(ws)):
            if ws[i:i + len(parts)] == parts:
                seen += 1
                if seen == occurrence: return round(self.words[i]['s'], 2)
        raise KeyError(f'{self.n}: "{phrase}" #{occurrence}')

    def end(self):
        return self.words[-1]['e']

    def html(self, duration):
        sub = json.dumps(chunks(self.toks), ensure_ascii=False)
        return f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE}{EXTRA}</style></head><body>
<div class="grid"></div>
{''.join(self.layers)}
<div class="sub" id="sub"><span class="box" id="subbox"></span></div>
<script>
{JS_HELPERS}
const CHUNKS = {sub}
window.render = (t) => {{
{chr(10).join(self.js)}
  subtitles(t)
}}
window.DURATION = {duration:.2f}
render(0)
</script></body></html>"""


def card(id, label, h1s, img, height):
    heads = ''.join(f'<h1 id="{id}-h{k}"{"" if k == 0 else " style=\"opacity:0\""}>{h}</h1>' for k, h in enumerate(h1s))
    return f"""<div id="{id}" class="layer"><div class="caption"><div class="label">{label}</div>{heads}</div>
<div class="card" id="{id}-card" style="height:{min(800, round(height * S))}px"><img id="{id}-img" src="shots/{img}"><div class="hl red" id="{id}-r"></div><div class="hl" id="{id}-g"></div><div class="scan" id="{id}-scan"></div></div></div>"""


def end_card(loop, small):
    return f"""<div id="end" class="layer"><img class="logo" id="end-logo" src="shots/logo.svg" style="top:340px">
<div class="center" style="top:630px;font-size:120px;font-weight:800;letter-spacing:-.03em">Tiltless</div>
<div class="center" id="end-loop" style="top:800px;font-size:64px;font-weight:700;letter-spacing:-.02em;line-height:1.1">{loop}</div>
<div class="center" style="top:1060px"><span class="pill">tiltless.xyz</span></div>
<div class="center" style="top:1190px;font-size:34px;color:var(--muted)">{small}</div></div>"""


END_JS = "if (show('end', t, {a}, 999)) {{ const l = prog(t, {a}, {a} + .5); $('end-logo').style.transform = `scale(${{.8 + .2 * l}}) rotate(${{(1 - l) * -8}}deg)` }}"
PRO_SMALL = '30 días de Pro gratis · regístrate antes del 30 de nov.'
DEMO = '<b>{}</b> · demo'


def reel03():
    r = Reel('03'); T = r.T
    a1, a2, a3, a4, a5, a6, a7, a8 = T('tiltless pro'), T('cada error'), T('también'), T('ahora sabes'), T('el diario'), T('registrate'), T('después'), T('mira', 2)
    r.layers.append(f"""<div id="hook" class="layer" style="opacity:1"><div class="hook-h sm" style="top:300px">Mira cuánto te<br><span class="r">cuestan tus errores.</span></div>
<div class="center label" style="top:650px"><b>Lo que costó</b> · mes de demostración</div>
<div class="costs"><div class="cost" id="c1"><span>Malas horas</span><b>−$332</b></div><div class="cost" id="c2"><span>Pasó el stop</span><b>−$280</b></div><div class="cost" id="c3"><span>FOMO</span><b>−$260</b></div></div>
<div class="center" id="free" style="top:1220px;opacity:0"><span class="pill-g">30 DÍAS GRATIS</span></div></div>""")
    r.js.append(f"if (show('hook', t, 0, {a1 - .1})) {{ slide('c1', t, .3); slide('c2', t, .7); slide('c3', t, 1.1); const f = prog(t, {T('30') - .1}, {T('30') + .2}); $('free').style.opacity = f; $('free').style.transform = `scale(${{.85 + .15 * f}})` }}")
    r.layers.append(card('launch', '<b>Nuevo</b> · Tiltless Pro', ['Tiltless Pro acaba de salir.<br><span class="g">El primer mes va por nuestra cuenta.</span>'], 'pro-hero.png', 420))
    r.js.append(f"if (show('launch', t, {a1 - .1}, {a2 - .1})) box('launch-g', prog(t, {T('primer')}, {T('primer') + .2}), [25, 222, 308, 86])")
    r.layers.append(card('cost', DEMO.format('Costo de los errores'), ['Cada error tiene<br>su precio en dólares.'], 'mistakeCost.png', 669))
    r.js.append(f"if (show('cost', t, {a2 - .1}, {a3 - .1})) box('cost-r', prog(t, {T('malas')}, {T('malas') + .2}), [17, 53, 324, 64])")
    r.layers.append(card('hold', DEMO.format('Tiempo en posición'), ['También cuenta<br>el tiempo en la operación.', 'Menos de una hora:<br><span class="r">−$1,475.</span>'], 'byHold.png', 362))
    r.js.append(f"if (show('hold', t, {a3 - .1}, {a4 - .1})) {{ swap(['hold-h0', 'hold-h1'], t, [{a3 - .1}, {T('menos de una')}]); box('hold-r', prog(t, {T('menos de una')}, {T('menos de una') + .2}), [17, 53, 324, 64 + 76 * 2]) }}")
    r.layers.append(card('habit', DEMO.format('Por emoción'), ['Ahora sabes qué hábito<br><span class="r">se come tu cuenta.</span>'], 'byEmotion.png', 533))
    r.js.append(f"if (show('habit', t, {a4 - .1}, {a5 - .1})) box('habit-r', prog(t, {T('hábitos')}, {T('hábitos') + .2}), [17, 53, 324, 67.3])")
    r.layers.append(card('freeplan', '<b>Plan gratis</b> · para siempre', ['El diario<br><span class="g">sigue siendo gratis.</span>'], 'pro-free.png', 370))
    r.js.append(f"show('freeplan', t, {a5 - .1}, {a6 - .1})")
    r.layers.append(f"""<div id="date" class="layer"><div class="caption"><div class="label"><b>Oferta de lanzamiento</b> · tiltless.xyz</div><h1>Regístrate antes del<br><span class="g">30 de noviembre.</span></h1></div>
<div class="cal" id="cal"><div class="m">NOV</div><div class="d">30</div></div>
<div class="center" id="nopay" style="top:1200px;opacity:0"><span class="pill-g">30 DÍAS DE PRO · SIN PAGO</span></div></div>""")
    r.js.append(f"if (show('date', t, {a6 - .1}, {a7 - .1})) {{ const c = prog(t, {a6 - .1}, {a6 + .4}); $('cal').style.transform = `scale(${{.85 + .15 * c}}) rotate(${{(1 - c) * -6}}deg)`; $('cal').style.opacity = c; $('nopay').style.opacity = prog(t, {T('sin pagar')}, {T('sin pagar') + .3}) }}")
    k2 = T('tus operaciones')
    r.layers.append(f"""<div id="call" class="layer"><div class="caption"><div class="label"><b>Después</b> · tú decides</div><h1 id="k1">Después,<br>tú decides.</h1><h1 id="k2" style="opacity:0">Tus operaciones<br><span class="g">se quedan donde están.</span></h1></div>
<div class="choice" id="ch1" style="top:620px"><div class="t">Quédate con <span class="g">Pro</span></div><div class="s">$15.99 al mes o $44.99 al año</div></div>
<div class="choice" id="ch2" style="top:900px"><div class="t">O sigue gratis</div><div class="s">Tu diario y tus operaciones se quedan</div></div></div>""")
    r.js.append(f"if (show('call', t, {a7 - .1}, {a8 - .1})) {{ swap(['k1', 'k2'], t, [{a7 - .1}, {k2}]); slide('ch1', t, {a7 + .1}); slide('ch2', t, {a7 + .5}); $('ch2').style.borderColor = t > {k2} ? 'var(--green)' : 'var(--border)'; $('ch2').style.boxShadow = t > {k2} ? '0 0 50px #3ecf8e44' : 'none' }}")
    r.layers.append(end_card('Mira cuánto te<br><span class="r">cuestan tus errores.</span>', PRO_SMALL))
    r.js.append(END_JS.format(a=a8 - .1))
    return r


def reel02():
    r = Reel('02'); T = r.T
    a1, a2, a3, a4, a5 = T('mes de'), T('ahora ordena'), T('las rápidas'), T('tu tasa'), T('encuentra')
    r.layers.append(f"""<div id="hook" class="layer" style="opacity:1"><div class="hook-h sm" id="hk1" style="top:250px">Deja de hacer<br><span class="r">operaciones de 15 minutos.</span></div>
<div class="hook-h sm" id="hk2" style="top:250px;opacity:0">Esto es<br><span class="r">lo que cuestan.</span></div>{WATCH_SVG.format(color='#f2555a')}<div class="counter" id="counter">−$0</div></div>""")
    r.js.append(f"if (show('hook', t, 0, {a1 - .1})) {{ watch(t, .3, 1.9); $('counter').textContent = '−$' + Math.round(620 * prog(t, .9, 2.4)); swap(['hk1', 'hk2'], t, [0, {T('esto es')}]) }}")
    r.layers.append(card('perf', '<b>Mes de demostración</b> · Tiltless', ['52% de acierto.<br><span class="g">Arriba $255.</span>', 'Se ve bien,<br>¿no?'], 'performance.png', 357))
    r.js.append(f"if (show('perf', t, {a1 - .1}, {a2 - .1})) {{ swap(['perf-h0', 'perf-h1'], t, [{a1 - .1}, {T('se ve')}]); box('perf-g', prog(t, {T('52')}, {T('52') + .2}), t < {T('arriba')} ? [17, 104.6, 158, 63.5] : [17, 53, 324, 39.6]) }}")
    t1, t2, t3 = T('menos de 15'), T('menos de una'), T('de una a')
    r.layers.append(card('hold', '<b>Mismas operaciones</b> · por tiempo', ['Ahora ordénalas por<br><span class="g">tiempo en posición.</span>', 'Menos de 15 min:<br><span class="r">4 operaciones, −$620.</span>', 'Menos de una hora:<br><span class="r">11 operaciones. 0 ganadoras.</span>', 'De una a cuatro horas:<br><span class="g">+$1,730.</span>'], 'byHold.png', 362))
    r.js.append(f"""if (show('hold', t, {a2 - .1}, {a3 - .1})) {{ swap(['hold-h0', 'hold-h1', 'hold-h2', 'hold-h3'], t, [{a2 - .1}, {t1}, {t2}, {t3}])
    $('hold-scan').style.opacity = t > {a2 + .3} && t < {t1 - .2} ? 1 : 0; $('hold-scan').style.top = (((t - {a2}) / 1) % 1) * 800 + 'px'
    if (t < {t2}) box('hold-r', prog(t, {t1}, {t1 + .2}), [17, 53, 324, 64 + 76]); else box('hold-r', t < {t3} ? 1 : 1 - prog(t, {t3}, {t3 + .2}), [17, 53, 324, 64 + 76 * 2])
    box('hold-g', prog(t, {t3 + .1}, {t3 + .3}), [17, 281, 324, 64]) }}""")
    r.layers.append(f"""<div id="ate" class="layer"><div class="caption"><div class="label"><b>Mes de demostración</b> · neto +$255</div><h1>Las rápidas se comieron<br>casi todo lo que ganaron<br><span class="g">las pacientes.</span></h1></div>
<div class="bars"><div class="bar-row"><div class="name">Más de una hora</div><div class="glow-g"><div class="bar green" id="b-green" style="width:800px"><span id="b-green-t">+$1,730</span></div></div></div>
<div class="bar-row"><div class="name">Menos de una hora</div><div class="glow-r"><div class="bar red" id="b-red" style="width:682px"><span id="b-red-t">−$1,475</span></div></div></div>
<div class="net" id="b-net" style="opacity:0">Quedó: +$255</div></div></div>""")
    r.js.append(f"""if (show('ate', t, {a3 - .1}, {a4 - .1})) {{ const reveal = (id, p) => {{ $(id).style.clipPath = `inset(0 ${{(1 - p) * 100}}% 0 0 round 18px)`; $(id + '-t').style.opacity = clamp((p - .6) / .4) }}
    reveal('b-green', prog(t, {a3 + .1}, {a3 + .8})); reveal('b-red', prog(t, {a3 + .8}, {a3 + 1.5})); $('b-net').style.opacity = prog(t, {a3 + 1.7}, {a3 + 2.0}) }}""")
    r.layers.append(f"""<div id="wr" class="layer"><div class="caption"><div class="label"><b>Tasa de acierto</b> · demo</div><h1>Tu tasa de acierto<br><span class="r">nunca te va a enseñar</span><br>eso.</h1></div>
<div class="center" style="top:780px"><span class="wr-num big">52%<span class="strike" id="strike"></span></span></div></div>""")
    r.js.append(f"if (show('wr', t, {a4 - .1}, {a5 - .1})) $('strike').style.clipPath = `inset(0 ${{(1 - prog(t, {T('nunca')}, {T('nunca') + .4})) * 100}}% 0 0)`")
    r.layers.append(end_card('Encuentra tus<br><span class="r">operaciones de 15 minutos.</span>', PRO_SMALL))
    r.js.append(END_JS.format(a=a5 - .1))
    return r


def reel04():
    r = Reel('04'); T = r.T
    a1, a2, a3, a4, a5 = T('esto es'), T('eso es'), T('tiltless lo'), T('así el'), T('15 minutos después', 2)
    s2 = T('necesitas', 2)
    r.layers.append(f"""<div id="hook" class="layer" style="opacity:1"><div class="hook-h sm" id="hk1" style="top:280px">No necesitas una<br>estrategia nueva.</div>
<div class="hook-h sm" id="hk2" style="top:250px;opacity:0">Necesitas <span class="g">15 minutos</span><br>después de una pérdida.</div>{WATCH_SVG.format(color='#3ecf8e')}</div>""")
    r.js.append(f"if (show('hook', t, 0, {a1 - .1})) {{ swap(['hk1', 'hk2'], t, [0, {s2}]); watch(t, {s2}, {a1 - .3}) }}")
    tres, cero = T('tres'), T('cero')
    r.layers.append(card('rev', DEMO.format('Costo de los errores'), ['Esto es un<br>mes de demostración.', '3 operaciones abiertas<br><span class="r">a menos de 15 min</span><br>de una pérdida.', 'Cero ganadoras.<br><span class="r">−$182.</span>'], 'mistakeCost.png', 669))
    r.js.append(f"if (show('rev', t, {a1 - .1}, {a2 - .1})) {{ swap(['rev-h0', 'rev-h1', 'rev-h2'], t, [{a1 - .1}, {tres}, {cero}]); box('rev-r', prog(t, {tres}, {tres + .2}), [17, 281, 324, 64]) }}")
    r.layers.append(card('hide', '<b>Tasa de acierto</b> · demo', ['Operar por revancha.<br>La tasa de acierto<br><span class="r">lo esconde.</span>'], 'performance.png', 357))
    r.js.append(f"if (show('hide', t, {a2 - .1}, {a3 - .1})) box('hide-g', prog(t, {T('tasa')}, {T('tasa') + .2}), [17, 104.6, 158, 63.5])")
    cual = T('cualquier')
    r.layers.append(f"""<div id="flag" class="layer"><div class="caption"><div class="label"><b>Automático</b> · Tiltless</div><h1 id="fl1">Tiltless lo marca<br><span class="g">por ti.</span></h1><h1 id="fl2" style="opacity:0">Cualquier operación a<br><span class="r">menos de 15 min</span><br>de una pérdida.</h1></div>
<div class="trow" style="top:640px" id="tr1"><div class="top"><span>ETHUSDT · Corto</span><b>−$60.00</b></div><div class="meta">Cerrada 10:02 · pérdida</div></div>
<div class="trow" style="top:900px" id="tr2"><div class="top"><span>ETHUSDT · Largo</span><b>−$80.00</b></div><div class="meta">Abierta 10:11 · 9 min después</div><span class="flag" id="fp">Operar por revancha</span></div></div>""")
    r.js.append(f"if (show('flag', t, {a3 - .1}, {a4 - .1})) {{ swap(['fl1', 'fl2'], t, [{a3 - .1}, {cual}]); slide('tr1', t, {a3}); slide('tr2', t, {a3 + .4}); const f = prog(t, {T('marca')}, {T('marca') + .3}); $('fp').style.opacity = f; $('fp').style.transform = `scale(${{.85 + .15 * f}})`; $('tr2').style.borderColor = f > .5 ? 'var(--red)' : 'var(--border)' }}")
    r.layers.append(card('name', DEMO.format('Costo de los errores'), ['Así el patrón por fin tiene<br><span class="g">nombre y precio.</span>'], 'mistakeCost.png', 669))
    r.js.append(f"if (show('name', t, {a4 - .1}, {a5 - .1})) box('name-r', prog(t, {T('nombre')}, {T('nombre') + .2}), [17, 281, 324, 64])")
    r.layers.append(end_card('15 minutos después de una pérdida.<br><span class="g">Esa es la estrategia.</span>', 'El diario es gratis · Pro 30 días gratis'))
    r.js.append(END_JS.format(a=a5 - .1))
    return r


def reel06():
    r = Reel('06'); T = r.T
    a1, a2, a3, a4 = T('es un'), T('mismo'), T('marca'), T('operar', 2)
    r.layers.append(f"""<div id="hook" class="layer" style="opacity:1"><div class="hook-h sm" style="top:280px">Operar con enojo<br><span class="r">te costó $680.</span></div>
<div class="duo"><div class="row" id="d1"><span>Con enojo</span><b class="r">−$680</b></div><div class="row" id="d2"><span>Con calma</span><b class="g">+$885</b></div></div></div>""")
    r.js.append(f"if (show('hook', t, 0, {a1 - .1})) {{ slide('d1', t, {T('costó')}); slide('d2', t, {T('con calma')}) }}")
    c4, c3, c16 = T('cuatro'), T('tres'), T('16')
    shift = 449.3 * S - 560
    r.layers.append(card('emo', DEMO.format('PnL por emoción'), ['Mes de demostración,<br>un solo trader.', 'Enojo: 4 operaciones.<br><span class="r">−$680.</span>', 'FOMO: 3 operaciones.<br><span class="r">−$390.</span>', 'Calma: 16 operaciones.<br><span class="g">+$885.</span>'], 'byEmotion.png', 533))
    r.js.append(f"""if (show('emo', t, {a1 - .1}, {a2 - .1})) {{ swap(['emo-h0', 'emo-h1', 'emo-h2', 'emo-h3'], t, [{a1 - .1}, {c4}, {c3}, {c16}])
    const dy = prog(t, {c16 - .1}, {c16 + .4}) * {shift:.1f}; $('emo-img').style.transform = `translateY(${{-dy}}px)`
    if (t < {c3}) box('emo-r', prog(t, {c4}, {c4 + .2}), [17, 53, 324, 67.3]); else box('emo-r', t < {c16} ? 1 : 1 - prog(t, {c16}, {c16 + .2}), [17, 132.3, 324, 67.3])
    box('emo-g', prog(t, {c16 + .3}, {c16 + .5}), [17, 449.3 - dy / S, 324, 67.3]) }}""")
    r.layers.append(f"""<div id="mood" class="layer"><div class="caption"><div class="label"><b>Mes de demostración</b> · una cuenta</div><h1>Mismo mercado.<br>Misma cuenta.<br><span class="g">Cambió el ánimo.</span></h1></div>
<div class="bars"><div class="bar-row"><div class="name">Con calma · 16 operaciones</div><div class="glow-g"><div class="bar green" id="m-green" style="width:800px"><span id="m-green-t">+$885</span></div></div></div>
<div class="bar-row"><div class="name">Con enojo · 4 operaciones</div><div class="glow-r"><div class="bar red" id="m-red" style="width:615px"><span id="m-red-t">−$680</span></div></div></div></div></div>""")
    r.js.append(f"""if (show('mood', t, {a2 - .1}, {a3 - .1})) {{ const reveal = (id, p) => {{ $(id).style.clipPath = `inset(0 ${{(1 - p) * 100}}% 0 0 round 18px)`; $(id + '-t').style.opacity = clamp((p - .6) / .4) }}
    reveal('m-green', prog(t, {a2 + .1}, {a2 + .8})); reveal('m-red', prog(t, {a2 + .8}, {a2 + 1.5})) }}""")
    chips = ''.join(f'<span class="chip{" calm" if k == "Calma" else ""}" id="chip-{i}">{k}</span>' for i, k in enumerate(['Calma', 'Confianza', 'Miedo', 'Enojo', 'FOMO', 'Codicia', 'Aburrimiento']))
    r.layers.append(f"""<div id="tag" class="layer"><div class="caption"><div class="label"><b>Antes de entrar</b> · ¿cómo te sientes?</div><h1>Marca cómo te sientes<br>antes de cada operación.</h1></div>
<div class="chips">{chips}</div><div class="center" id="tag-note" style="top:1080px;font-size:44px;color:var(--muted);opacity:0">Tiltless te enseña la diferencia en dólares.</div></div>""")
    r.js.append(f"if (show('tag', t, {a3 - .1}, {a4 - .1})) {{ const k = Math.floor(clamp((t - {a3}) / 1.6) * 3.99); ['chip-0', 'chip-3', 'chip-4', 'chip-0'].forEach((id, i) => $(id).classList.toggle('on', i === k)); $('tag-note').style.opacity = prog(t, {T('tiltless')}, {T('tiltless') + .3}) }}")
    r.layers.append(end_card('Operar con enojo<br><span class="r">tiene precio.</span>', 'El diario es gratis · Pro 30 días gratis'))
    r.js.append(END_JS.format(a=a4 - .1))
    return r


def reel07():
    r = Reel('07'); T = r.T
    a1, a2, a3, a4 = T('mes de'), T('cada una'), T('registra'), T('solo esta', 2)
    r.layers.append(f"""<div id="hook" class="layer" style="opacity:1"><div class="hook-h sm" style="top:260px">Mover tu stop<br><span class="r">“solo esta vez”</span></div>
<svg class="chart" viewBox="0 0 800 440"><polyline id="price" fill="none" stroke="#ededed" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" points=""/>
<line id="stopln" x1="0" x2="800" stroke="#f2555a" stroke-width="6" stroke-dasharray="22 14"/><text id="stoptx" x="790" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="34" fill="#f2555a">STOP</text></svg>
<div class="counter" id="counter" style="top:1110px">−$0</div></div>""")
    r.js.append(f"""if (show('hook', t, 0, {a1 - .1})) {{
    const pts = [[0,120],[90,140],[170,110],[250,170],[330,200],[410,260],[490,250],[570,320],[650,350],[730,390],[800,410]]
    const p = prog(t, .2, 2.6), n = Math.max(2, Math.round(p * pts.length)); $('price').setAttribute('points', pts.slice(0, n).map((q) => q.join(',')).join(' '))
    const sy = 240 + prog(t, .9, 1.4) * 70 + prog(t, 1.6, 2.1) * 70 + prog(t, 2.2, 2.6) * 60; $('stopln').setAttribute('y1', sy); $('stopln').setAttribute('y2', sy); $('stoptx').setAttribute('y', sy - 14)
    $('counter').textContent = '−$' + Math.round(280 * prog(t, {T('costó')}, {T('costó') + .8})); $('counter').style.opacity = prog(t, {T('costó') - .2}, {T('costó')}) }}""")
    c4, c0 = T('cuatro'), T('cero')
    r.layers.append(card('stop', DEMO.format('Costo de los errores'), ['Mes de demostración.<br>4 operaciones pasaron el stop.', 'Cero ganadoras.<br><span class="r">−$280.</span>'], 'mistakeCost.png', 669))
    r.js.append(f"if (show('stop', t, {a1 - .1}, {a2 - .1})) {{ swap(['stop-h0', 'stop-h1'], t, [{a1 - .1}, {c0}]); box('stop-r', prog(t, {c4}, {c4 + .2}), [17, 129, 324, 64]) }}")
    ju = T('juntas')
    r.layers.append(card('exc', DEMO.format('Costo de los errores'), ['Cada una se sintió<br>como una excepción.', 'Juntas: el <span class="r">segundo hábito</span><br>más caro del mes.'], 'mistakeCost.png', 669))
    r.js.append(f"if (show('exc', t, {a2 - .1}, {a3 - .1})) {{ swap(['exc-h0', 'exc-h1'], t, [{a2 - .1}, {ju}]); box('exc-r', prog(t, {ju}, {ju + .2}), [17, 53, 324, 64 + 76]) }}")
    tm = T('tiltless')
    r.layers.append(f"""<div id="flag" class="layer"><div class="caption"><div class="label"><b>Automático</b> · Tiltless</div><h1 id="fl1">Registra tu stop.</h1><h1 id="fl2" style="opacity:0">Tiltless marca cada<br><span class="r">operación que lo pasó.</span></h1></div>
<div class="trow" style="top:640px" id="tr1"><div class="top"><span>BTCUSDT · Largo</span><b>−$120.00</b></div><div class="meta">Stop 67,000 · salida 66,400</div><span class="flag" id="fp">Aguantó pasado el stop</span></div></div>""")
    r.js.append(f"if (show('flag', t, {a3 - .1}, {a4 - .1})) {{ swap(['fl1', 'fl2'], t, [{a3 - .1}, {tm}]); slide('tr1', t, {a3}); const f = prog(t, {tm}, {tm + .3}); $('fp').style.opacity = f; $('fp').style.transform = `scale(${{.85 + .15 * f}})`; $('tr1').style.borderColor = f > .5 ? 'var(--red)' : 'var(--border)' }}")
    r.layers.append(end_card('“Solo esta vez”<br><span class="r">tiene precio.</span>', 'El diario es gratis · Pro 30 días gratis'))
    r.js.append(END_JS.format(a=a4 - .1))
    return r


BUILDERS = {'03': reel03, '02': reel02, '04': reel04, '06': reel06, '07': reel07}
for n in sys.argv[1:]:
    r = BUILDERS[n]()
    duration = r.end() + 0.9
    open(f'stage-{n}.html', 'w').write(r.html(duration))
    print(n, round(duration, 2), 'chunks', len(chunks(r.toks)))
