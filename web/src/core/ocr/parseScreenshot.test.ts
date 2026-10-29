import { describe, expect, it } from 'vitest'
import { dateTimeIn, normalizeNumber, parseScreenshotText, quantityFromValue, type ParsedScreenshot } from './parseScreenshot'

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
    ['0,100', '0.100'],
    ['014670', '0.14670'],
    ['1,2,3', undefined],
    ['abc', undefined],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeNumber(raw)).toBe(expected)
  })

  it('reads a comma as the decimal point in a Russian interface', () => {
    expect(normalizeNumber('1,500')).toBe('1500')
    expect(normalizeNumber('1,500', true)).toBe('1.500')
    expect(normalizeNumber('61,234.5', true)).toBe('61234.5')
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

describe('Russian interface', () => {
  it('reads the Binance app card with Russian labels and number format', () => {
    const text = `BTCUSDT Бессрочный   Закрыто
Лонг  Кросс 20x
PnL закрытия
+123,40 USDT
Цена входа        Ср. цена закрытия
60 000,0          61 234,0
Объём закрытия    0,100 BTC
Открыто 27.10.2026 10:15:02`
    expect(values(parseScreenshotText(text))).toEqual({
      // "Бессрочный" is on OKX cards too, so it doesn't name the exchange.
      exchange: undefined,
      symbol: 'BTCUSDT',
      side: 'long',
      entryPrice: '60000.0',
      exitPrice: '61234.0',
      quantity: '0.100',
      leverage: '20',
      pnl: '123.40',
    })
  })

  it('reads the Bybit closed P&L entry and confirms it by the printed PnL', () => {
    const parsed = parseScreenshotText(`ETHUSDT   Закрыть шорт
Закрытый P&L   −45,1200
Кол-во    1,50
Цена входа   3 100,25
Цена выхода  3 130,33`)
    expect(values(parsed)).toMatchObject({ symbol: 'ETHUSDT', side: 'short', entryPrice: '3100.25', exitPrice: '3130.33', quantity: '1.50', pnl: '45.1200' })
    expect(parsed.entryPrice?.confidence).toBe('high')
  })

  it('reads labels whose letters OCR took from the Latin alphabet', () => {
    // "Цeнa вxoдa" with Latin e, a, x, o; "BTCUSDТ" with a Cyrillic Т.
    const parsed = parseScreenshotText('BTCUSDТ\nЦeнa вxoдa 61 885,4\nЦeнa зaкpытия 62 010,1')
    expect(values(parsed)).toMatchObject({ symbol: 'BTCUSDT', entryPrice: '61885.4', exitPrice: '62010.1' })
  })

  it('restores decimal commas that OCR dropped', () => {
    const parsed = parseScreenshotText('Цена входа    Ср. цена закрытия\n61 3911    60 1871\nКол-во 12 186')
    expect(values(parsed)).toMatchObject({ entryPrice: '61391.1', exitPrice: '60187.1', quantity: '12186' })
  })

  it('shifts a price that lost both its space and comma to the other price', () => {
    const parsed = parseScreenshotText('BTCUSDT Шорт\nPnL закрытия +167,36\nЦена входа    Ср. цена закрытия\n613911    60 1871\nОбъём закрытия 0,139 BTC')
    expect(values(parsed)).toMatchObject({ entryPrice: '61391.1', exitPrice: '60187.1' })
    // The printed PnL matches the shifted price, so it is confirmed.
    expect(parsed.entryPrice?.confidence).toBe('high')
  })

  it('keeps English thousands when OCR reads "Avg." as Cyrillic', () => {
    const parsed = parseScreenshotText('DOGE-USDT-SWAP\nАуд. close price\n0.14907\nClosed amount\n9,683 DOGE')
    expect(values(parsed)).toMatchObject({ exitPrice: '0.14907', quantity: '9683' })
  })

  it('reads the OKX share card: "Входная цена", an unlabelled PnL and no size', () => {
    const parsed = parseScreenshotText(`27.10.2026, 12:50:52 (UTC-5)
ZECUSDT Бессрочные
Лонг | 20x | Закрытие
+15,80 %
138,27 USDT
Входная цена        Цена закрытия
1 294,3             1 305,68
Реферальный код LL65NYIK`)
    expect(values(parsed)).toEqual({
      exchange: undefined,
      symbol: 'ZECUSDT',
      side: 'long',
      entryPrice: '1294.3',
      exitPrice: '1305.68',
      // 138.27 / (1305.68 − 1294.3): the card has no size, so it comes from the PnL.
      quantity: '12.1503',
      leverage: '20',
      pnl: '138.27',
    })
    expect(parsed.quantity?.confidence).toBe('low')
    expect(parsed.entryPrice?.confidence).toBe('low')
  })

  it('joins thousands split by a space on Russian lines', () => {
    expect(parseScreenshotText('Кол-во 1 000 XRP').quantity?.value).toBe('1000')
  })

  it('does not merge two columns of an English table row', () => {
    const parsed = parseScreenshotText('Qty    Entry Price\n3    150.25')
    expect(values(parsed)).toMatchObject({ quantity: '3', entryPrice: '150.25' })
  })

  it.each([
    ['Покупка', 'long'],
    ['Продажа', 'short'],
  ])('reads %s as %s with low confidence', (word, side) => {
    expect(parseScreenshotText(`SOLUSDT ${word}`).side).toEqual({ value: side, confidence: 'low' })
  })

  it('reads leverage written with a Cyrillic х', () => {
    expect(parseScreenshotText('Кросс 25х').leverage?.value).toBe('25')
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

describe('position with its order history', () => {
  // A phone position screen: the net PnL and value on top, the fees and times below, then the
  // closing and opening orders with their fill prices and values (newest first).
  const russian = `ZECUSDT Бессрочные Лонг
Реализованный PnL (USDT) Закрытие (USDT)
+107,03 9 997,93
Реализованный PnL +116,08 USDT
Торговая комиссия -9,0503685 USDT
Комиссия за финансирование --
Время открытия 26.10.2026, 11:39:19
Время закрытия 26.10.2026, 12:44:28
История ордеров
Закрыть лонг 26.10, 12:44:28 +116,08 USDT
Исполнено 10 114,00 USDT
Цена зап. ₮1 201,18822413
Комиссия -4,5513 USDT
Номер ордера 4044458914072629248
Открыть лонг 26.10, 11:39:19
Исполнено 9 997,93 USDT
Цена зап. ₮1 187,4021593
Комиссия -4,4990685 USDT
Номер ордера 4044327766373830656`

  it('takes the entry from the opening order and the exit from the closing one', () => {
    const parsed = parseScreenshotText(russian)
    expect(values(parsed)).toMatchObject({ symbol: 'ZECUSDT', side: 'long', entryPrice: '1187.4021593', exitPrice: '1201.18822413', quantity: '8.42', pnl: '107.03' })
    expect(parsed.quantityUnit).toBe('base')
    // The net PnL matches once the fees are taken off, which confirms the fields.
    expect(parsed.entryPrice?.confidence).toBe('high')
    expect(parsed.quantity?.confidence).toBe('high')
  })

  it('reads the total fee, leaving funding out, and the open and close times', () => {
    const parsed = parseScreenshotText(russian)
    expect(parsed.fees?.value).toBe('9.0503685')
    expect(parsed.openedAt?.value).toBe('2026-10-26T11:39')
    expect(parsed.closedAt?.value).toBe('2026-10-26T12:44')
  })

  it('adds up the orders’ fees when there is no total', () => {
    const parsed = parseScreenshotText(russian.replace(/Торговая комиссия.*\n/, ''))
    expect(parsed.fees).toEqual({ value: '9.0503685', confidence: 'low' })
  })

  it('reads the English screen of a short', () => {
    const text = `DOGEUSDT Perpetual Short
Realized PnL (USDT)   Close (USDT)
+118.10   4,681.77
Trading fee  -4.3618 USDT
Funding fee  -0.42 USDT
Open time  2026-10-24 09:02:11
Close time  2026-10-24 16:30:05
Order history
Close short  10-24 16:30:05  +122.47 USDT
Filled  4,559.30 USDT
Fill price  0.17950012
Fee  -2.0517 USDT
Open short  10-24 09:02:11
Filled  4,681.77 USDT
Fill price  0.18432177
Fee  -2.3101 USDT`
    const parsed = parseScreenshotText(text)
    expect(values(parsed)).toMatchObject({ symbol: 'DOGEUSDT', side: 'short', entryPrice: '0.18432177', exitPrice: '0.17950012', quantity: '25400' })
    expect(parsed.fees?.value).toBe('4.3618')
    expect(parsed.openedAt?.value).toBe('2026-10-24T09:02')
    expect(parsed.closedAt?.value).toBe('2026-10-24T16:30')
  })

  it('drops a currency sign OCR read as a leading 1 when the orders’ sizes disagree', () => {
    const misread = russian.replace('₮1 201,18822413', '11 201,18822413').replace('₮1 187,4021593', '1 187,4021593')
    const parsed = parseScreenshotText(misread)
    // Fixed, then confirmed by the printed PnL.
    expect(parsed.exitPrice).toEqual({ value: '1201.18822413', confidence: 'high' })
    expect(parsed.entryPrice?.value).toBe('1187.4021593')
    const small = parseScreenshotText(`XRPUSDT Бессрочные Шорт
Закрыть шорт 27.10, 12:40:11
Исполнено 517,06 USDT
Цена зап. 10,5489
Открыть шорт 27.10, 10:15:02
Исполнено 519,14 USDT
Цена зап. 10,5511`)
    expect(values(small)).toMatchObject({ entryPrice: '0.5511', exitPrice: '0.5489', quantity: '942' })
  })

  it('takes the size from the order whose price lost no digit', () => {
    const parsed = parseScreenshotText(`XRPUSDT Шорт
Закрыть шорт
Исполнено 517,06 USDT
Цена зап. 0,5489
Открыть шорт
Исполнено 519,14 USDT
Цена зап. 0,551`)
    expect(parsed.quantity?.value).toBe('942')
    // …and puts back the digit the other price lost.
    expect(parsed.entryPrice).toEqual({ value: '0.5511', confidence: 'low' })
  })

  it('outside an order, "Цена исполнения" is still the entry', () => {
    expect(parseScreenshotText('BTCUSDT Лонг\nЦена исполнения 61 000,5').entryPrice?.value).toBe('61000.5')
  })
})

describe('quantityFromValue', () => {
  it.each([
    ['9997.93', '1187.4021593', '8.42'],
    ['4681.77', '0.18432177', '25400'],
    ['6100.05', '61000.5', '0.1'],
    ['0', '100', undefined],
  ])('%s at %s → %s', (value, price, expected) => {
    expect(quantityFromValue(value, price)).toBe(expected)
  })
})

describe('dateTimeIn', () => {
  it.each([
    ['Opened 2026-10-27 10:15:02', '2026-10-27T10:15'],
    ['Время открытия 26.10.2026, 11:39:19', '2026-10-26T11:39'],
    ['Открыто 7.3.2026 9:05', '2026-03-07T09:05'],
    ['Закрыть лонг 26.10, 12:44:28', undefined],
    ['2026-13-01 10:00', undefined],
  ])('%s → %s', (line, expected) => {
    expect(dateTimeIn(line)).toBe(expected)
  })
})
