import { describe, expect, it } from 'vitest'
import { normalizeNumber, parseScreenshotText, type ParsedScreenshot } from './parseScreenshot'

// Text as OCR returns it from screenshots: one line per row, labels and values sometimes on
// separate lines, stray "|" from table borders, letter-for-digit slips.

const values = (parsed: ParsedScreenshot) => ({
  exchange: parsed.exchange,
  symbol: parsed.symbol?.value,
  side: parsed.side?.value,
  entryPrice: parsed.entryPrice?.value,
  exitPrice: parsed.exitPrice?.value,
  quantity: parsed.quantity?.value,
  leverage: parsed.leverage?.value,
  pnl: parsed.pnl?.value,
})

describe('normalizeNumber', () => {
  it.each([
    ['61,234.50', '61234.50'],
    ['61.234,5', '61234.5'],
    ['0,25', '0.25'],
    ['+123.45', '123.45'],
    ['-0.100', '0.100'],
    ['6O,OOO.O', '60000.0'],
    ['S7,147.7', '57147.7'],
    ['1,2,3', undefined],
    ['abc', undefined],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeNumber(raw)).toBe(expected)
  })
})

describe('Binance', () => {
  it('reads the app position history card', () => {
    const text = `BTCUSDT Perpetual   Closed
Long  Cross 20x
Closing PNL
+123.40 USDT
Entry Price        Avg. Close Price
60,000.0           61,234.0
Max Open Interest   0.100 BTC
Closed Vol.         0.100 BTC
Opened 2026-10-27 10:15:02
Closed 2026-10-27 12:40:11`
    expect(values(parseScreenshotText(text))).toEqual({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      side: 'long',
      entryPrice: '60000.0',
      exitPrice: '61234.0',
      quantity: '0.100',
      leverage: '20',
      pnl: '123.40',
    })
  })

  it('confirms fields when the printed PnL matches', () => {
    const parsed = parseScreenshotText(`ETHUSDT Perpetual
Short 10x
Closing PNL -45.00 USDT
Entry Price 3,000.00
Avg. Close Price 3,015.00
Closed Vol. 3.000 ETH`, 60)
    expect(parsed.side).toEqual({ value: 'short', confidence: 'high' })
    expect(parsed.entryPrice?.confidence).toBe('high')
  })

  it('keeps low confidence when OCR was unsure and nothing confirms it', () => {
    const parsed = parseScreenshotText(`SOLUSDT Perpetual
Long 5x
Entry Price 150.20
Avg. Close Price 148.90`, 60)
    expect(parsed.entryPrice?.confidence).toBe('low')
    expect(parsed.quantity).toBeUndefined()
  })
})

describe('Bybit', () => {
  it('reads the closed P&L entry', () => {
    const text = `BTCUSDT   Close Long
Closed P&L   +62.35
Qty          0.050
Entry Price  60,120.5
Exit Price   61,367.5
Trade Time   2026-10-27 12:40:11`
    expect(values(parseScreenshotText(text))).toMatchObject({
      exchange: 'bybit',
      symbol: 'BTCUSDT',
      side: 'long',
      entryPrice: '60120.5',
      exitPrice: '61367.5',
      quantity: '0.050',
      pnl: '62.35',
    })
  })

  it('reads a closing sell without the word long as a long', () => {
    const parsed = parseScreenshotText(`XRPUSDT
Closing Direction: Close Sell
Qty 1,000
Entry Price 0.5210
Exit Price 0.5390`)
    expect(parsed.side).toEqual({ value: 'long', confidence: 'low' })
    expect(parsed.quantity?.value).toBe('1000')
  })
})

describe('OKX', () => {
  it('reads the position history with label-above-value layout', () => {
    const text = `BTC-USDT-SWAP
Short | 25x | Cross
Realized PnL
+88.20 USDT
Avg. entry price
62,500.1
Avg. close price
61,618.1
Closed amount
0.1 BTC`
    expect(values(parseScreenshotText(text))).toMatchObject({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      side: 'short',
      entryPrice: '62500.1',
      exitPrice: '61618.1',
      quantity: '0.1',
      leverage: '25',
    })
  })

  it('reads a size given in USDT as a quote-currency size', () => {
    const parsed = parseScreenshotText(`ETH-USDT-SWAP Long 3x
Avg. open price 3,100.5
Avg. close price 3,180.0
Position size 1,500 USDT`)
    expect(parsed.quantity?.value).toBe('1500')
    expect(parsed.quantityUnit).toBe('quote')
  })
})

describe('TradingView', () => {
  it('reads a trading panel history table', () => {
    const text = `TradingView Paper Trading
History
Symbol | Side | Qty | Avg Fill Price | Close Price | Realized P&L
BINANCE:BTCUSDT | Long | 0.1 | 60,000.0 | 61,234.5 | +123.45`
    expect(values(parseScreenshotText(text))).toMatchObject({
      exchange: 'tradingview',
      symbol: 'BTCUSDT',
      side: 'long',
      quantity: '0.1',
      entryPrice: '60000.0',
      exitPrice: '61234.5',
      pnl: '123.45',
    })
  })

  it('strips the perpetual and continuous-futures suffixes', () => {
    expect(parseScreenshotText('BYBIT:ETHUSDT.P Short').symbol?.value).toBe('ETHUSDT')
    expect(parseScreenshotText('CME_MINI:ES1! Long').symbol?.value).toBe('ES')
  })

  it('does not shift values when a table row has extra columns', () => {
    const parsed = parseScreenshotText(`Symbol Qty Avg Fill Price Close Price
BINANCE:BTCUSDT 0.1 60000 61000 12:30 41.5%`)
    expect(parsed.quantity?.value).toBe('0.1')
    expect(parsed.exitPrice?.value).toBe('61000')
  })
})

describe('noise and missing data', () => {
  it('reads digits mistaken for letters and ignores table borders', () => {
    const parsed = parseScreenshotText(`| SOLUSDT Perpetual | Long |
| Entry Price | 15O.2O |
| Avg. Close Price | 162.4O |`)
    expect(parsed.entryPrice?.value).toBe('150.20')
    expect(parsed.exitPrice?.value).toBe('162.40')
  })

  it('reads a 5 misread as S at the start of a price', () => {
    const parsed = parseScreenshotText('Avg. close price\n\nS7147.7\n\nClosed amount\n\n0.484 BTC')
    expect(parsed.exitPrice?.value).toBe('57147.7')
    expect(parsed.quantity?.value).toBe('0.484')
  })

  it('does not take the ROI percentage or leverage as a price', () => {
    const parsed = parseScreenshotText(`BTCUSDT Perpetual Long 20x
ROI +41.15%
Entry Price 60,000.0`)
    expect(parsed.entryPrice?.value).toBe('60000.0')
    expect(parsed.pnl).toBeUndefined()
  })

  it('returns nothing for unrelated text', () => {
    expect(values(parseScreenshotText('Hello world\nNothing to see here'))).toEqual({
      exchange: undefined,
      symbol: undefined,
      side: undefined,
      entryPrice: undefined,
      exitPrice: undefined,
      quantity: undefined,
      leverage: undefined,
      pnl: undefined,
    })
  })
})
