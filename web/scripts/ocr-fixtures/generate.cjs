// Generates synthetic exchange screenshots for testing the screenshot reader.
//
// Real exchange screenshots are copyrighted and can't live in this repository, so these
// pages imitate the layouts and wording of Binance, Bybit, OKX and TradingView history
// screens (not their branding) with varied pairs, sides, prices and themes, in English and,
// for the phone screens, in Russian and Spanish; plus a phone position screen with its order
// history, where the entry and exit are the opening and closing orders' fill prices. The Spanish
// screens use the Mexican number format ("61,234.5"), as exchanges show it in Latin America.
//
// Usage (needs Playwright with Chromium installed):
//   node scripts/ocr-fixtures/generate.cjs
// Writes test-fixtures/ocr/*.png and test-fixtures/ocr/expected.json.

const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { chromium } = require('playwright')

const OUT = join(__dirname, '../../test-fixtures/ocr')

// Deterministic pseudo-random numbers, so regenerating gives the same set.
let seed = 20261027
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const pick = (items) => items[Math.floor(random() * items.length)]

const PAIRS = [
  { base: 'BTC', price: 61000, decimals: 1, qty: [0.01, 0.5], qtyDecimals: 3 },
  { base: 'ETH', price: 3100, decimals: 2, qty: [0.1, 5], qtyDecimals: 2 },
  { base: 'SOL', price: 152, decimals: 3, qty: [1, 60], qtyDecimals: 1 },
  { base: 'XRP', price: 0.5321, decimals: 4, qty: [100, 5000], qtyDecimals: 0 },
  { base: 'DOGE', price: 0.1532, decimals: 5, qty: [500, 20000], qtyDecimals: 0 },
  { base: 'BNB', price: 590, decimals: 2, qty: [0.5, 10], qtyDecimals: 2 },
]

const group = (value, decimals) =>
  Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
// Russian format: "61 234,5" with a space between thousands and a decimal comma.
const groupRu = (value, decimals) =>
  Number(value).toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

function makeTrade() {
  const pair = pick(PAIRS)
  const side = random() < 0.5 ? 'long' : 'short'
  const entry = pair.price * (0.95 + random() * 0.1)
  const move = entry * (random() * 0.04 - 0.02)
  const exit = entry + move
  const qty = pair.qty[0] + random() * (pair.qty[1] - pair.qty[0])
  const r = (value, d) => Number(value.toFixed(d))
  const trade = {
    base: pair.base,
    symbol: `${pair.base}USDT`,
    side,
    entry: r(entry, pair.decimals),
    exit: r(exit, pair.decimals),
    qty: r(qty, pair.qtyDecimals),
    leverage: pick([3, 5, 10, 20, 25, 50]),
    decimals: pair.decimals,
    qtyDecimals: pair.qtyDecimals,
  }
  trade.pnl = (trade.exit - trade.entry) * trade.qty * (side === 'long' ? 1 : -1)
  return trade
}

const THEMES = {
  dark: { bg: '#0b0e11', card: '#1e2329', text: '#eaecef', muted: '#848e9c', green: '#2ebd85', red: '#f6465d', line: '#2b3139' },
  light: { bg: '#f5f5f5', card: '#ffffff', text: '#1e2329', muted: '#707a8a', green: '#03a66d', red: '#cf304a', line: '#eaecef' },
}

const signed = (value, decimals = 2) => `${value >= 0 ? '+' : '-'}${group(Math.abs(value), decimals)}`
const signedRu = (value, decimals = 2) => `${value >= 0 ? '+' : '−'}${groupRu(Math.abs(value), decimals)}`
const sideRu = (side) => (side === 'long' ? 'Лонг' : 'Шорт')
const sideEs = (side) => (side === 'long' ? 'Largo' : 'Corto')
const tone = (theme, value) => (value >= 0 ? theme.green : theme.red)
const cap = (word) => word[0].toUpperCase() + word.slice(1)

const page = (theme, width, body) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; background: ${theme.bg}; color: ${theme.text}; font: 15px/1.4 -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; width: ${width}px; }
  .card { background: ${theme.card}; margin: 12px; padding: 16px; border-radius: 12px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; }
  .muted { color: ${theme.muted}; }
  .big { font-size: 22px; font-weight: 600; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid ${theme.line}; white-space: nowrap; }
  th { color: ${theme.muted}; font-weight: 500; }
  .tag { padding: 1px 6px; border-radius: 4px; font-size: 13px; }
</style></head><body>${body}</body></html>`

// Phone layouts: label and value on one row, or label above value.
const LAYOUTS = {
  binanceApp: (t, th) => page(th, 390, `<div class="card">
    <div class="row"><span class="big">${t.symbol} Perpetual</span><span class="muted">Closed</span></div>
    <div class="row"><span><span class="tag" style="background:${tone(th, t.side === 'long' ? 1 : -1)}33;color:${tone(th, t.side === 'long' ? 1 : -1)}">${cap(t.side)}</span> <span class="muted">Cross ${t.leverage}x</span></span></div>
    <div class="muted" style="margin-top:10px">Closing PNL</div>
    <div class="big" style="color:${tone(th, t.pnl)}">${signed(t.pnl)} USDT</div>
    <div class="row" style="margin-top:10px"><span class="muted">Entry Price</span><span class="muted">Avg. Close Price</span></div>
    <div class="row"><span>${group(t.entry, t.decimals)}</span><span>${group(t.exit, t.decimals)}</span></div>
    <div class="row"><span class="muted">Closed Vol.</span><span>${group(t.qty, t.qtyDecimals)} ${t.base}</span></div>
    <div class="row"><span class="muted">Opened</span><span>2026-10-27 10:15:02</span></div>
    <div class="row"><span class="muted">Closed</span><span>2026-10-27 12:40:11</span></div>
  </div>`),

  bybitApp: (t, th) => page(th, 390, `<div class="card">
    <div class="row"><span class="big">${t.symbol}</span><span style="color:${tone(th, t.side === 'long' ? 1 : -1)}">Close ${cap(t.side)}</span></div>
    <div class="row"><span class="muted">Closed P&amp;L</span><span style="color:${tone(th, t.pnl)}">${signed(t.pnl, 4)}</span></div>
    <div class="row"><span class="muted">Qty</span><span>${group(t.qty, t.qtyDecimals)}</span></div>
    <div class="row"><span class="muted">Entry Price</span><span>${group(t.entry, t.decimals)}</span></div>
    <div class="row"><span class="muted">Exit Price</span><span>${group(t.exit, t.decimals)}</span></div>
    <div class="row"><span class="muted">Trade Time</span><span>2026-10-27 12:40:11</span></div>
  </div>`),

  okxApp: (t, th) => page(th, 390, `<div class="card">
    <div class="big">${t.base}-USDT-SWAP</div>
    <div class="muted">${cap(t.side)} · ${t.leverage}x · Cross</div>
    <div class="muted" style="margin-top:12px">Realized PnL</div>
    <div class="big" style="color:${tone(th, t.pnl)}">${signed(t.pnl)} USDT</div>
    <div class="muted" style="margin-top:10px">Avg. entry price</div><div>${group(t.entry, t.decimals)}</div>
    <div class="muted" style="margin-top:10px">Avg. close price</div><div>${group(t.exit, t.decimals)}</div>
    <div class="muted" style="margin-top:10px">Closed amount</div><div>${group(t.qty, t.qtyDecimals)} ${t.base}</div>
  </div>`),

  // Desktop layouts: a header row and a row of values.
  binanceDesktop: (t, th) => page(th, 1100, `<div class="card"><table>
    <tr><th>Symbol</th><th>Side</th><th>Entry Price</th><th>Avg. Close Price</th><th>Closed Vol.</th><th>Closing PNL</th></tr>
    <tr><td>${t.symbol} Perp ${t.leverage}x</td><td style="color:${tone(th, t.side === 'long' ? 1 : -1)}">${cap(t.side)}</td><td>${group(t.entry, t.decimals)}</td><td>${group(t.exit, t.decimals)}</td><td>${group(t.qty, t.qtyDecimals)} ${t.base}</td><td style="color:${tone(th, t.pnl)}">${signed(t.pnl)} USDT</td></tr>
  </table></div>`),

  tradingViewDesktop: (t, th) => page(th, 1000, `<div class="card"><div class="muted" style="margin-bottom:8px">Paper Trading · History</div><table>
    <tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Avg Fill Price</th><th>Close Price</th><th>Realized P&amp;L</th></tr>
    <tr><td>BINANCE:${t.symbol}</td><td>${cap(t.side)}</td><td>${group(t.qty, t.qtyDecimals)}</td><td>${group(t.entry, t.decimals)}</td><td>${group(t.exit, t.decimals)}</td><td style="color:${tone(th, t.pnl)}">${signed(t.pnl)}</td></tr>
  </table></div>`),

  // The same phone screens with the interface in Russian.
  binanceAppRu: (t, th) => page(th, 390, `<div class="card">
    <div class="row"><span class="big">${t.symbol} Бессрочный</span><span class="muted">Закрыто</span></div>
    <div class="row"><span><span class="tag" style="background:${tone(th, t.side === 'long' ? 1 : -1)}33;color:${tone(th, t.side === 'long' ? 1 : -1)}">${sideRu(t.side)}</span> <span class="muted">Кросс ${t.leverage}x</span></span></div>
    <div class="muted" style="margin-top:10px">PnL закрытия</div>
    <div class="big" style="color:${tone(th, t.pnl)}">${signedRu(t.pnl)} USDT</div>
    <div class="row" style="margin-top:10px"><span class="muted">Цена входа</span><span class="muted">Ср. цена закрытия</span></div>
    <div class="row"><span>${groupRu(t.entry, t.decimals)}</span><span>${groupRu(t.exit, t.decimals)}</span></div>
    <div class="row"><span class="muted">Объём закрытия</span><span>${groupRu(t.qty, t.qtyDecimals)} ${t.base}</span></div>
    <div class="row"><span class="muted">Открыто</span><span>27.10.2026 10:15:02</span></div>
    <div class="row"><span class="muted">Закрыто</span><span>27.10.2026 12:40:11</span></div>
  </div>`),

  bybitAppRu: (t, th) => page(th, 390, `<div class="card">
    <div class="row"><span class="big">${t.symbol}</span><span style="color:${tone(th, t.side === 'long' ? 1 : -1)}">Закрыть ${sideRu(t.side).toLowerCase()}</span></div>
    <div class="row"><span class="muted">Закрытый P&amp;L</span><span style="color:${tone(th, t.pnl)}">${signedRu(t.pnl, 4)}</span></div>
    <div class="row"><span class="muted">Кол-во</span><span>${groupRu(t.qty, t.qtyDecimals)}</span></div>
    <div class="row"><span class="muted">Цена входа</span><span>${groupRu(t.entry, t.decimals)}</span></div>
    <div class="row"><span class="muted">Цена выхода</span><span>${groupRu(t.exit, t.decimals)}</span></div>
    <div class="row"><span class="muted">Время сделки</span><span>27.10.2026 12:40:11</span></div>
  </div>`),

  okxAppRu: (t, th) => page(th, 390, `<div class="card">
    <div class="big">${t.base}-USDT-SWAP</div>
    <div class="muted">${sideRu(t.side)} · ${t.leverage}x · Кросс</div>
    <div class="muted" style="margin-top:12px">Реализованный PnL</div>
    <div class="big" style="color:${tone(th, t.pnl)}">${signedRu(t.pnl)} USDT</div>
    <div class="muted" style="margin-top:10px">Средняя цена открытия</div><div>${groupRu(t.entry, t.decimals)}</div>
    <div class="muted" style="margin-top:10px">Средняя цена закрытия</div><div>${groupRu(t.exit, t.decimals)}</div>
    <div class="muted" style="margin-top:10px">Закрытая сумма</div><div>${groupRu(t.qty, t.qtyDecimals)} ${t.base}</div>
  </div>`),

  // A position screen with its order history: net PnL on top, then the closing and opening
  // orders with their fill prices and values, as some exchanges' phone apps show a closed trade.
  orderHistoryRu: (t, th) => {
    const open = t.entry * t.qty
    const close = t.exit * t.qty
    const fee = (value) => value * 0.00045
    const net = t.pnl - fee(open) - fee(close)
    const sideWord = sideRu(t.side).toLowerCase()
    const price = (value) => `₮${groupRu(value, Math.max(t.decimals, 4))}`
    const order = (label, color, value, fill, time) => `
      <div class="row" style="margin-top:14px"><span><span class="tag" style="background:${color}22;color:${color}">${label} ${sideWord}</span> <span class="muted">27.10, ${time}</span></span></div>
      <div class="row"><span class="muted">Исполнено</span><span>${groupRu(value, 2)} USDT</span></div>
      <div class="row"><span class="muted">Цена зап.</span><span>${price(fill)}</span></div>
      <div class="row"><span class="muted">Комиссия</span><span>−${groupRu(fee(value), 8)} USDT</span></div>`
    return page(th, 390, `<div class="card">
      <div class="row"><span class="big">${t.symbol} Бессрочные</span><span class="tag" style="color:${tone(th, t.side === 'long' ? 1 : -1)}">${sideRu(t.side)}</span></div>
      <div class="row"><span class="muted">Реализованный PnL (USDT)</span><span class="muted">Закрытие (USDT)</span></div>
      <div class="row"><span class="big" style="color:${tone(th, net)}">${signedRu(net)}</span><span class="big">${groupRu(open, 2)}</span></div>
      <div class="row"><span class="muted">Реализованный PnL</span><span>${signedRu(t.pnl)} USDT</span></div>
      <div class="row"><span class="muted">Торговая комиссия</span><span>−${groupRu(fee(open) + fee(close), 8)} USDT</span></div>
      <div class="row"><span class="muted">Комиссия за финансирование</span><span>--</span></div>
      <div class="row"><span class="muted">Время открытия</span><span>27.10.2026, 10:15:02</span></div>
      <div class="row"><span class="muted">Время закрытия</span><span>27.10.2026, 12:40:11</span></div>
      <div class="big" style="margin-top:14px">История ордеров</div>
      ${order('Закрыть', th.red, close, t.exit, '12:40:11')}
      ${order('Открыть', th.green, open, t.entry, '10:15:02')}
    </div>`)
  },
  // Spanish interface (new layouts go last, so the earlier screenshots stay the same).
  binanceAppEs: (t, th) => page(th, 390, `<div class="card">
    <div class="row"><span class="big">${t.symbol} Perpetuo</span><span class="muted">Cerrado</span></div>
    <div class="row"><span><span class="tag" style="background:${tone(th, t.side === 'long' ? 1 : -1)}33;color:${tone(th, t.side === 'long' ? 1 : -1)}">${sideEs(t.side)}</span> <span class="muted">Cruzado ${t.leverage}x</span></span></div>
    <div class="muted" style="margin-top:10px">PNL de cierre</div>
    <div class="big" style="color:${tone(th, t.pnl)}">${signed(t.pnl)} USDT</div>
    <div class="row" style="margin-top:10px"><span class="muted">Precio de entrada</span><span class="muted">Precio promedio de cierre</span></div>
    <div class="row"><span>${group(t.entry, t.decimals)}</span><span>${group(t.exit, t.decimals)}</span></div>
    <div class="row"><span class="muted">Vol. cerrado</span><span>${group(t.qty, t.qtyDecimals)} ${t.base}</span></div>
    <div class="row"><span class="muted">Abierto</span><span>27/10/2026 10:15:02</span></div>
    <div class="row"><span class="muted">Cerrado</span><span>27/10/2026 12:40:11</span></div>
  </div>`),

  bybitAppEs: (t, th) => page(th, 390, `<div class="card">
    <div class="row"><span class="big">${t.symbol}</span><span style="color:${tone(th, t.side === 'long' ? 1 : -1)}">Cerrar ${sideEs(t.side).toLowerCase()}</span></div>
    <div class="row"><span class="muted">P&amp;L cerrado</span><span style="color:${tone(th, t.pnl)}">${signed(t.pnl, 4)}</span></div>
    <div class="row"><span class="muted">Cant.</span><span>${group(t.qty, t.qtyDecimals)}</span></div>
    <div class="row"><span class="muted">Precio de entrada</span><span>${group(t.entry, t.decimals)}</span></div>
    <div class="row"><span class="muted">Precio de salida</span><span>${group(t.exit, t.decimals)}</span></div>
    <div class="row"><span class="muted">Hora de la operación</span><span>27/10/2026 12:40:11</span></div>
  </div>`),

  okxAppEs: (t, th) => page(th, 390, `<div class="card">
    <div class="big">${t.base}-USDT-SWAP</div>
    <div class="muted">${sideEs(t.side)} · ${t.leverage}x · Cruzado</div>
    <div class="muted" style="margin-top:12px">PnL realizado</div>
    <div class="big" style="color:${tone(th, t.pnl)}">${signed(t.pnl)} USDT</div>
    <div class="muted" style="margin-top:10px">Precio de entrada prom.</div><div>${group(t.entry, t.decimals)}</div>
    <div class="muted" style="margin-top:10px">Precio de cierre prom.</div><div>${group(t.exit, t.decimals)}</div>
    <div class="muted" style="margin-top:10px">Monto cerrado</div><div>${group(t.qty, t.qtyDecimals)} ${t.base}</div>
  </div>`),

  binanceDesktopEs: (t, th) => page(th, 1100, `<div class="card"><table>
    <tr><th>Símbolo</th><th>Lado</th><th>Precio de entrada</th><th>Precio promedio de cierre</th><th>Vol. cerrado</th><th>PNL de cierre</th></tr>
    <tr><td>${t.symbol} Perp ${t.leverage}x</td><td style="color:${tone(th, t.side === 'long' ? 1 : -1)}">${sideEs(t.side)}</td><td>${group(t.entry, t.decimals)}</td><td>${group(t.exit, t.decimals)}</td><td>${group(t.qty, t.qtyDecimals)} ${t.base}</td><td style="color:${tone(th, t.pnl)}">${signed(t.pnl)} USDT</td></tr>
  </table></div>`),

  orderHistoryEs: (t, th) => {
    const open = t.entry * t.qty
    const close = t.exit * t.qty
    const fee = (value) => value * 0.00045
    const net = t.pnl - fee(open) - fee(close)
    const sideWord = sideEs(t.side).toLowerCase()
    const price = (value) => `₮${group(value, Math.max(t.decimals, 4))}`
    const order = (label, color, value, fill, time) => `
      <div class="row" style="margin-top:14px"><span><span class="tag" style="background:${color}22;color:${color}">${label} ${sideWord}</span> <span class="muted">27/10, ${time}</span></span></div>
      <div class="row"><span class="muted">Ejecutado</span><span>${group(value, 2)} USDT</span></div>
      <div class="row"><span class="muted">Precio de ejec.</span><span>${price(fill)}</span></div>
      <div class="row"><span class="muted">Comisión</span><span>-${group(fee(value), 8)} USDT</span></div>`
    return page(th, 390, `<div class="card">
      <div class="row"><span class="big">${t.symbol} Perpetuos</span><span class="tag" style="color:${tone(th, t.side === 'long' ? 1 : -1)}">${sideEs(t.side)}</span></div>
      <div class="row"><span class="muted">PnL realizado (USDT)</span><span class="muted">Cierre (USDT)</span></div>
      <div class="row"><span class="big" style="color:${tone(th, net)}">${signed(net)}</span><span class="big">${group(open, 2)}</span></div>
      <div class="row"><span class="muted">PnL realizado</span><span>${signed(t.pnl)} USDT</span></div>
      <div class="row"><span class="muted">Comisión de trading</span><span>-${group(fee(open) + fee(close), 8)} USDT</span></div>
      <div class="row"><span class="muted">Comisión de financiación</span><span>--</span></div>
      <div class="row"><span class="muted">Hora de apertura</span><span>27/10/2026, 10:15:02</span></div>
      <div class="row"><span class="muted">Hora de cierre</span><span>27/10/2026, 12:40:11</span></div>
      <div class="big" style="margin-top:14px">Historial de órdenes</div>
      ${order('Cerrar', th.red, close, t.exit, '12:40:11')}
      ${order('Abrir', th.green, open, t.entry, '10:15:02')}
    </div>`)
  },
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ deviceScaleFactor: 2 })
  const tab = await context.newPage()
  const expected = []
  let index = 0
  for (const [layout, render] of Object.entries(LAYOUTS)) {
    for (const themeName of ['dark', 'light', 'dark', 'light', 'dark']) {
      const trade = makeTrade()
      const file = `${String(++index).padStart(2, '0')}-${layout}-${themeName}.png`
      await tab.setContent(render(trade, THEMES[themeName]))
      await tab.locator('.card').first().screenshot({ path: join(OUT, file) })
      expected.push({
        file,
        layout,
        theme: themeName,
        symbol: trade.symbol,
        side: trade.side,
        entryPrice: trade.entry.toFixed(trade.decimals),
        exitPrice: trade.exit.toFixed(trade.decimals),
        quantity: trade.qty.toFixed(trade.qtyDecimals),
      })
    }
  }
  writeFileSync(join(OUT, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`)
  await browser.close()
  console.log(`Wrote ${expected.length} screenshots to ${OUT}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
