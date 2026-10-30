# Shared pieces for the 3D reels (02x, 04x, 07x). Run builders from scratchpad/es with PYTHONPATH=.:x3d
import json, sys
sys.argv = sys.argv[:1]
import build  # noqa: E402

CSS = """
  .stage3d { position:absolute; inset:0; overflow:hidden }
  .scene { position:absolute; left:540px; top:900px; width:0; height:0; transform-style:preserve-3d; transform-origin:0 0 }
  .scene * { transform-style:preserve-3d }
  .win { position:absolute; left:0; top:0; width:1440px; height:944px; border-radius:22px; overflow:hidden; background:#121212;
    border:2px solid #ffffff1f; box-shadow:0 60px 160px -20px #000, 0 0 120px -30px #3ecf8e66 }
  .win * { transform-style:flat }
  .chrome { height:44px; background:#1b1b1b; border-bottom:1px solid #2e2e2e; display:flex; align-items:center; gap:10px; padding:0 18px }
  .chrome i { width:14px; height:14px; border-radius:50%; background:#3a3a3a; display:block }
  .chrome .url { margin-left:24px; flex:0 0 520px; height:28px; border-radius:8px; background:#121212; color:#a0a0a0; font:500 16px 'JetBrains Mono', monospace; display:flex; align-items:center; padding-left:14px }
  .chrome .url b { color:#3ecf8e; font-weight:500 }
  .view { position:absolute; left:0; top:44px; width:1440px; height:900px; overflow:hidden }
  .view img { position:absolute; left:0; top:0; width:1440px }
  .sweep { position:absolute; inset:-200px; background:linear-gradient(105deg, transparent 40%, #ffffff16 48%, #3ecf8e22 50%, transparent 58%); opacity:0 }
  .crop { position:absolute; border-radius:14px; background-repeat:no-repeat; background-color:#1a1a1a; border:2px solid #2e2e2e; box-shadow:0 30px 80px -10px #000 }
  .crop.r { border-color:#f2555a; box-shadow:0 30px 80px -10px #000, 0 0 50px #f2555a88 }
  .crop.g { border-color:#3ecf8e; box-shadow:0 30px 80px -10px #000, 0 0 50px #3ecf8e88 }
  .tag3d { position:absolute; padding:18px 30px; border-radius:22px; font:700 54px 'JetBrains Mono', monospace; white-space:nowrap; background:#121212ee }
  .tag3d.r { color:#f2555a; border:3px solid #f2555a; box-shadow:0 0 60px #f2555a77, 0 40px 80px -10px #000 }
  .tag3d.g { color:#3ecf8e; border:3px solid #3ecf8e; box-shadow:0 0 60px #3ecf8e77, 0 40px 80px -10px #000 }
  .tag3d span { font:600 40px Inter, sans-serif; color:#ededed; margin-right:22px }
  .ext { position:absolute; left:0; width:1080px; text-align:center }
  .ext div { position:absolute; left:0; right:0; font:800 210px 'JetBrains Mono', monospace; letter-spacing:-.06em }
  .ext .lbl { font:700 54px Inter, sans-serif; letter-spacing:-.01em; color:#ededed; top:-80px }
  .cursor { position:absolute; width:56px; height:56px; opacity:0; filter:drop-shadow(0 6px 10px #000a) }
  .ripple { position:absolute; width:140px; height:140px; margin:-70px 0 0 -70px; border-radius:50%; border:5px solid #3ecf8e; opacity:0 }
  .face3 { position:absolute; backface-visibility:hidden }
  .gridfloor { position:absolute; background-image:linear-gradient(#3ecf8e30 2px, transparent 2px), linear-gradient(90deg, #3ecf8e30 2px, transparent 2px); background-size:100px 100px }
  #flash { position:absolute; inset:0; background:#fff; opacity:0; pointer-events:none }
"""

JS = """
const lerp = (a, b, p) => a + (b - a) * p
const easeOutExpo = (x) => x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x))
const easeOutBack = (x) => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }
const easeOutBounce = (x) => { x = clamp(x); const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375; return n * (x -= 2.625 / d) * x + .984375 }
function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, A] = keys[i], [b, B, e] = keys[i + 1]
    if (t < b) { const x = (t - a) / (b - a); const p = e === 'expo' ? easeOutExpo(x) : e === 'lin' ? x : ease(x); const o = {}; for (const k in A) o[k] = lerp(A[k], B[k], p); return o }
  }
  return keys[keys.length - 1][1]
}
// Camera looks at (x, y, w) in scene space from distance z (positive = closer), tilted rx, turned ry, rolled rz.
const camCss = (c) => `translateZ(${c.z}px) rotateZ(${c.rz || 0}deg) rotateX(${c.rx}deg) rotateY(${c.ry}deg) translate3d(${-c.x}px, ${-c.y}px, ${-(c.w || 0)}px)`
const shake = (t, at, dur = .35, amp = 18) => { const k = clamp(1 - (t - at) / dur); return t < at ? [0, 0] : [Math.sin(t * 91) * amp * k, Math.cos(t * 77) * amp * k] }
function heads(t, cues) {
  cues.forEach(([a, id], i) => { if (!id) return; const b = cues[i + 1] ? cues[i + 1][0] : 999; const o = Math.min(clamp((t - a) / .2), clamp((b - t) / .15)); const el = $(id); el.style.opacity = o; el.style.transform = `translateY(${(1 - clamp((t - a) / .3)) * 30}px)`; el.style.filter = `blur(${(1 - clamp((t - a) / .25)) * 8}px)` })
}
function labels(t, cues) { let s = ''; for (const [a, txt] of cues) if (t >= a) s = txt; $('lbl').innerHTML = s; $('lbl').style.opacity = s ? 1 : 0 }
const flashAt = (t, list) => list.reduce((o, [a, v]) => o + (t > a && t < a + .08 ? v : 0), 0)
// A box rising from the floor (y = 0 is the floor, up is -y): front, sides and top faces.
function bar(id, h, w, d) {
  const el = $(id); const [f, l, r, tp] = el.children
  f.style.cssText += `;width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h}px;transform:translateZ(${d / 2}px)`
  l.style.cssText += `;width:${d}px;height:${h}px;left:${-d / 2}px;top:${-h}px;transform:rotateY(-90deg) translateZ(${w / 2}px)`
  r.style.cssText += `;width:${d}px;height:${h}px;left:${-d / 2}px;top:${-h}px;transform:rotateY(90deg) translateZ(${w / 2}px)`
  tp.style.cssText += `;width:${w}px;height:${d}px;left:${-w / 2}px;top:${-d / 2}px;transform:translateY(${-h}px) rotateX(90deg)`
}
"""

CURSOR = '<svg class="cursor" id="{id}" viewBox="0 0 24 24"><path d="M4 2 L4 20 L9 15 L12.5 22 L15.5 20.5 L12 13.8 L19 13.8 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>'


def win(id, url, img, extra=''):
    return f"""<div class="win" id="{id}"><div class="chrome"><i></i><i></i><i></i><div class="url">tiltless.xyz/<b>{url}</b></div></div>
<div class="view"><img id="{id}-img" src="{img}"></div><div class="sweep" id="{id}-sweep"></div>{extra}</div>"""


def crop(id, img, x, y, w, h, cls='', pad=10, style=''):
    """A piece of a 1440-wide page screenshot, cut at CSS coordinates."""
    return (f'<div class="crop {cls}" id="{id}" style="left:0;top:0;width:{w + 2 * pad}px;height:{h + 2 * pad}px;'
            f'background-image:url({img});background-size:1440px auto;background-position:{-(x - pad)}px {-(y - pad)}px;{style}"></div>')


def shade(hex_, k):
    h = hex_.lstrip('#'); rgb = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    f = 0.55 - k * 0.025
    return '#' + ''.join(f'{max(0, int(c * f)):02x}' for c in rgb)


def ext(id, text, color, top, label='', size=210, depth=16):
    layers = ''.join(f'<div style="transform:translateZ({-k * 5}px);color:{shade(color, k)};font-size:{size}px">{text}</div>' for k in range(depth, 0, -1))
    lbl = f'<div class="lbl">{label}</div>' if label else ''
    return f'<div class="ext" id="{id}" style="top:{top}px;opacity:0;transform-style:preserve-3d">{layers}<div style="color:{color};text-shadow:0 0 50px {color}88;font-size:{size}px">{text}</div>{lbl}</div>'


def bar_html(id, color, label_html=''):
    side = shade(color, 6); top = color
    return (f'<div id="{id}" style="position:absolute;left:0;top:0;transform-style:preserve-3d">'
            f'<div class="face3" style="background:linear-gradient(180deg,{color},{shade(color, 2)});box-shadow:0 0 60px {color}55"></div>'
            f'<div class="face3" style="background:{side}"></div><div class="face3" style="background:{side}"></div>'
            f'<div class="face3" style="background:{top};filter:brightness(1.25)"></div>{label_html}</div>')


def page(reel, body, js, heads_html, end_html, duration):
    sub = json.dumps(build.chunks(reel.toks), ensure_ascii=False)
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{build.BASE}{build.EXTRA}{CSS}</style></head><body>
<div class="grid"></div>
{body}
<div id="heads" class="layer" style="opacity:1"><div class="caption"><div class="label" id="lbl"></div>{heads_html}</div></div>
{end_html}
<div id="flash"></div>
<div class="sub" id="sub"><span class="box" id="subbox"></span></div>
<script>
{build.JS_HELPERS}
{JS}
const CHUNKS = {sub}
window.render = (t) => {{
{js}
  subtitles(t)
}}
window.DURATION = {duration:.2f}
render(0)
</script></body></html>"""


def h1s(lines):
    return ''.join(f'<h1 id="hd{i}" style="opacity:0">{h}</h1>' for i, h in enumerate(lines))


def save(n, html, cues):
    open(f'stage-{n}x.html', 'w').write(html)
    json.dump(cues, open(f'x3d/sfx-{n}.json', 'w'))
