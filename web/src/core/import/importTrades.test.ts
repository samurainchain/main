import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import { headerOffset, importCsv, normalizeHeader, normalizeSymbol, parseAmount, parseDate, parseSideValue } from './importTrades'

// Files shaped like the exchanges' documented exports. The exact headers change between
// versions, so the importer goes by wording, not by position.

const trades = (text: string) =>
  importCsv(text).trades.map(({ symbol, side, entryPrice, exitPrice, quantity, fees, leverage, openedAt, closedAt }) => ({
    symbol,
    side,
    entryPrice,
    exitPrice,
    quantity,
    fees,
    leverage,
    openedAt,
    closedAt,
  }))

describe('parseCsv', () => {
  it('reads quotes, escaped quotes, CRLF and a byte-order mark', () => {
    const { rows, delimiter } = parseCsv('﻿a,b,c\r\n"1,5","say ""hi""",x\r\n\r\n')
    expect(delimiter).toBe(',')
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1,5', 'say "hi"', 'x'],
    ])
  })

  it('picks the separator from the header', () => {
    expect(parseCsv('a;b;c\n1,5;2;3').rows).toEqual([
      ['a', 'b', 'c'],
      ['1,5', '2', '3'],
    ])
    expect(parseCsv('a\tb\n1\t2').delimiter).toBe('\t')
  })
})

describe('values', () => {
  it.each([
    ['-12.3 USDT', '-12.3'],
    ['1,234.5', '1234.5'],
    ['0.24000000 USDT', '0.24'],
    ['−0,5', '-0.5'],
    ['1.234,5', '1234.5'],
    ['1,234', '1234'],
    ['USDT 5', '5'],
    ['--', undefined],
    ['', undefined],
  ])('amount %s → %s', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected)
  })

  it('reads a comma as decimal in a semicolon file', () => {
    expect(parseAmount('1,234', true)).toBe('1.234')
  })

  it.each([
    ['BTC-USDT-SWAP', 'BTCUSDT'],
    ['BTC/USDT', 'BTCUSDT'],
    ['BTCUSDT Perpetual', 'BTCUSDT'],
    ['BYBIT:ETHUSDT.P', 'ETHUSDT'],
    ['1000PEPEUSDT', '1000PEPEUSDT'],
    ['12.5', undefined],
  ])('symbol %s → %s', (raw, expected) => {
    expect(normalizeSymbol(raw)).toBe(expected)
  })

  it('reads sides and directions', () => {
    expect(parseSideValue('Close Long')).toEqual({ kind: 'direction', side: 'long' })
    expect(parseSideValue('SELL')).toEqual({ kind: 'order', buy: false })
    expect(parseSideValue('Лонг')).toEqual({ kind: 'direction', side: 'long' })
    expect(parseSideValue('Trade')).toBeUndefined()
  })

  it('reads dates in the zone the header names', () => {
    expect(headerOffset('Date(UTC)')).toBe(0)
    expect(headerOffset('Trade Time(UTC+8)')).toBe(480)
    expect(headerOffset('Time')).toBeUndefined()
    expect(parseDate('2026-10-27 12:40:11', { offset: 0, dayFirst: false })).toBe('2026-10-27T12:40:11.000Z')
    expect(parseDate('2026-10-27 12:40:11', { offset: 480, dayFirst: false })).toBe('2026-10-27T04:40:11.000Z')
    expect(parseDate('2026-10-27T12:40:11.123+02:00')).toBe('2026-10-27T10:40:11.123Z')
    expect(parseDate('10/27/2026 12:40:11 PM', { offset: 0, dayFirst: false })).toBe('2026-10-27T12:40:11.000Z')
    expect(parseDate('27.10.2026 08:05', { offset: 0, dayFirst: true })).toBe('2026-10-27T08:05:00.000Z')
    expect(parseDate('1793098811000')).toBe(new Date(1793098811000).toISOString())
    expect(parseDate('Trade')).toBeUndefined()
  })

  it('normalizes headers', () => {
    expect(normalizeHeader('Avg. Close Price')).toBe('avg close price')
    expect(normalizeHeader('Trade Time(UTC+0)')).toBe('trade time')
    expect(normalizeHeader('Closed P&L')).toBe('closed p&l')
  })
})

describe('closed positions', () => {
  it('reads the Bybit closed P&L export, side from the closing direction', () => {
    const csv = `Contracts,Closing Direction,Qty,Entry Price,Exit Price,Closed P&L,Exit Type,Trade Time(UTC+0)
BTCUSDT,Sell,0.010,60000.0,61234.0,12.27,Trade,2026-10-27 12:40:11
ETHUSDT,Buy,1.5,3100.25,3130.33,-45.38,Trade,2026-10-27 13:02:45`
    expect(trades(csv)).toEqual([
      {
        symbol: 'BTCUSDT',
        side: 'long',
        entryPrice: '60000',
        exitPrice: '61234',
        quantity: '0.01',
        // 12.34 by price minus the 12.27 reported: fees and funding.
        fees: '0.07',
        leverage: undefined,
        openedAt: '2026-10-27T12:40:11.000Z',
        closedAt: '2026-10-27T12:40:11.000Z',
      },
      {
        symbol: 'ETHUSDT',
        side: 'short',
        entryPrice: '3100.25',
        exitPrice: '3130.33',
        quantity: '1.5',
        fees: '0.26',
        leverage: undefined,
        openedAt: '2026-10-27T13:02:45.000Z',
        closedAt: '2026-10-27T13:02:45.000Z',
      },
    ])
  })

  it('reads the OKX position history with open and close times, leverage and fees', () => {
    const csv = `Instrument,Margin mode,Leverage,Side,Open time,Avg. entry price,Avg. close price,Closed amount,Realized PnL,Fee,Close time
BTC-USDT-SWAP,Cross,20,Long,10/27/2026 10:15:02,60000.0,61234.0,0.01 BTC,11.84,-0.5,10/27/2026 12:40:11
SOL-USDT-SWAP,Isolated,10x,Short,10/27/2026 14:00:00,152.1,150.0,20 SOL,41.2,-0.8,10/27/2026 15:30:00`
    const result = importCsv(csv)
    expect(result.shape).toBe('positions')
    expect(result.trades.map(({ symbol, side, quantity, fees, leverage }) => ({ symbol, side, quantity, fees, leverage }))).toEqual([
      { symbol: 'BTCUSDT', side: 'long', quantity: '0.01', fees: '0.5', leverage: '20' },
      { symbol: 'SOLUSDT', side: 'short', quantity: '20', fees: '0.8', leverage: '10' },
    ])
    // No zone in the header: local time.
    expect(result.trades[0]!.openedAt).toBe(new Date(2026, 9, 27, 10, 15, 2).toISOString())
    expect(result.pnlMismatch).toBe(false)
  })

  it('reads the Binance position history and skips rows it can’t use', () => {
    // The side comes from the PnL's sign when no side column can be trusted; without a PnL it can't.
    const csv = `Symbol,Position Side,Entry Price,Avg. Close Price,Max Open Interest,Closed Vol.,Closing PNL,Opened,Closed
BTCUSDT Perpetual,Long,"60,000.0","61,234.0",0.200 BTC,0.100 BTC,123.40 USDT,2026-10-27 10:15:02,2026-10-27 12:40:11
ETHUSDT Perpetual,Short,3100,,1 ETH,1 ETH,5 USDT,2026-10-27 10:15:02,2026-10-27 12:40:11
XRPUSDT Perpetual,Sideways,0.55,0.56,100 XRP,100 XRP,,2026-10-27 10:15:02,2026-10-27 12:40:11`
    const result = importCsv(csv)
    expect(result.trades).toHaveLength(1)
    expect(result.trades[0]).toMatchObject({ symbol: 'BTCUSDT', side: 'long', entryPrice: '60000', exitPrice: '61234', quantity: '0.1' })
    expect(result.skipped).toEqual([
      { row: 2, reason: 'missingValue' },
      { row: 3, reason: 'badSide' },
    ])
  })

  it('gives every trade a key, so the same file imports once', () => {
    const csv = `Symbol,Side,Entry Price,Exit Price,Qty,Close Time
BTCUSDT,Long,100,110,1,2026-10-27 12:00:00`
    expect(importCsv(csv).trades[0]!.key).toBe(importCsv(csv).trades[0]!.key)
  })

  it('warns when the PnL in the file doesn’t match the prices and size', () => {
    // OKX sizes in contracts of 0.01 BTC: 1 contract here is 0.01 BTC.
    const csv = `Instrument,Side,Avg. entry price,Avg. close price,Closed amount,Realized PnL,Close time
BTC-USDT-SWAP,Long,60000,61000,1,10,2026-10-27 12:00:00
BTC-USDT-SWAP,Long,60000,60500,2,10,2026-10-27 13:00:00`
    expect(importCsv(csv).pnlMismatch).toBe(true)
  })

  it('lets the trader pick a column by hand', () => {
    const csv = `Pair,Way,In,Out,Coins,When
BTCUSDT,Long,100,110,1,2026-10-27 12:00:00`
    expect(importCsv(csv).shape).toBeUndefined()
    const result = importCsv(csv, { symbol: 0, side: 1, entryPrice: 2, exitPrice: 3, quantity: 4, closeTime: 5 })
    expect(result.trades[0]).toMatchObject({ symbol: 'BTCUSDT', side: 'long', entryPrice: '100', exitPrice: '110', quantity: '1' })
  })
})

describe('fills', () => {
  const binance = `Date(UTC),Symbol,Side,Price,Quantity,Amount,Fee,Realized Profit
2026-10-27 10:00:00,BTCUSDT,BUY,60000,0.010,600 USDT,0.24 USDT,0 USDT
2026-10-27 10:30:00,BTCUSDT,BUY,61000,0.010,610 USDT,0.24 USDT,0 USDT
2026-10-27 11:00:00,BTCUSDT,SELL,62000,0.020,1240 USDT,0.50 USDT,30 USDT
2026-10-27 12:00:00,ETHUSDT,SELL,3100,1,3100 USDT,1.24 USDT,0 USDT
2026-10-27 12:10:00,ETHUSDT,BUY,3000,0.4,1200 USDT,0.48 USDT,40 USDT
2026-10-27 12:20:00,ETHUSDT,BUY,3050,1.6,4880 USDT,1.95 USDT,30 USDT`

  it('rebuilds round trips from Binance fills, scaling in and out', () => {
    const result = importCsv(binance)
    expect(result.shape).toBe('fills')
    expect(result.columns.quantity).toBe(4)
    expect(trades(binance)).toEqual([
      {
        symbol: 'BTCUSDT',
        side: 'long',
        entryPrice: '60500',
        exitPrice: '62000',
        quantity: '0.02',
        fees: '0.98',
        leverage: undefined,
        openedAt: '2026-10-27T10:00:00.000Z',
        closedAt: '2026-10-27T11:00:00.000Z',
      },
      {
        // Short 1 ETH closed by two buys; the second buy also opens a 1 ETH long, still open.
        symbol: 'ETHUSDT',
        side: 'short',
        entryPrice: '3100',
        exitPrice: '3030',
        quantity: '1',
        // 1.24 + 0.48, and the closing 0.6 of the last buy's 1.95.
        fees: '2.45125',
        leverage: undefined,
        openedAt: '2026-10-27T12:00:00.000Z',
        closedAt: '2026-10-27T12:20:00.000Z',
      },
    ])
    expect(result.openPositions).toBe(1)
  })

  it('follows long and short positions apart in hedge mode', () => {
    const csv = `Time,Symbol,Side,Position Side,Price,Qty
2026-10-27T10:00:00Z,BTCUSDT,BUY,LONG,100,1
2026-10-27T10:01:00Z,BTCUSDT,SELL,SHORT,101,1
2026-10-27T10:02:00Z,BTCUSDT,SELL,LONG,105,1
2026-10-27T10:03:00Z,BTCUSDT,BUY,SHORT,99,1`
    expect(importCsv(csv).trades.map(({ side, entryPrice, exitPrice }) => ({ side, entryPrice, exitPrice }))).toEqual([
      { side: 'long', entryPrice: '100', exitPrice: '105' },
      { side: 'short', entryPrice: '101', exitPrice: '99' },
    ])
  })
})
