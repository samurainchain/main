import Big from 'big.js'
import type { Side } from '../models'
import { parseCsv } from './csv'

// Exchange CSV import (SPEC section 2, version 1.1). Columns are found by their header wording,
// checked against their contents, so exports from Binance, OKX and Bybit (and others that
// name things the usual way) import without a per-exchange parser; the preview lets the
// trader fix a column that was guessed wrong. Two kinds of files are understood:
// - closed positions: one row per trade, with entry and exit price (Bybit "Closed P&L",
//   OKX and Binance position history);
// - fills: one row per execution, buy or sell at a price (Binance "Trade History"); trades are
//   rebuilt by following each symbol's position until it is flat again.

export const IMPORT_FIELDS = [
  'symbol',
  'side',
  'closingSide',
  'positionSide',
  'entryPrice',
  'exitPrice',
  'price',
  'quantity',
  'pnl',
  'fee',
  'leverage',
  'openTime',
  'closeTime',
  'time',
] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]
/** Column index of each field. */
export type ColumnMap = Partial<Record<ImportField, number>>
export type ImportShape = 'positions' | 'fills'
export type SkipReason = 'missingValue' | 'badNumber' | 'badDate' | 'badSide'

export interface ImportedTrade {
  symbol: string
  side: Side
  entryPrice: string
  exitPrice: string
  quantity: string
  fees: string
  leverage?: string
  openedAt: string
  closedAt: string
  /** PnL the exchange reports, when the file has it. */
  realizedPnl?: string
  /** Same trade, same key: importing a file twice adds nothing. */
  key: string
}

export interface ImportResult {
  headers: string[]
  columns: ColumnMap
  shape?: ImportShape
  trades: ImportedTrade[]
  /** Data rows that couldn't become a trade, numbered from 1 after the header. */
  skipped: { row: number; reason: SkipReason }[]
  /** Fills of positions still open at the end of the file: not imported. */
  openPositions: number
  /** Most trades' computed PnL is far from the file's: the size may be in contracts, not coins. */
  pnlMismatch: boolean
}

// Header wording per field, normalized (lowercase, no punctuation or "(UTC)"), most specific
// first. A header is taken only when the column's contents fit the field.
const SYNONYMS: Record<ImportField, string[]> = {
  symbol: ['symbol', 'contracts', 'contract', 'instrument', 'instrument id', 'market', 'pair', 'trading pair', 'инструмент', 'символ', 'пара', 'контракт'],
  closingSide: ['closing direction', 'close direction', 'closing side', 'close side', 'exit side', 'направление закрытия'],
  positionSide: ['position side', 'pos side', 'сторона позиции'],
  side: ['side', 'direction', 'position direction', 'order side', 'trade side', 'type', 'сторона', 'направление'],
  entryPrice: [
    'entry price',
    'avg entry price',
    'average entry price',
    'entry avg price',
    'open price',
    'avg open price',
    'average open price',
    'opening price',
    'opening avg price',
    'open avg price',
    'цена входа',
    'входная цена',
    'средняя цена открытия',
    'цена открытия',
  ],
  exitPrice: [
    'exit price',
    'avg exit price',
    'exit avg price',
    'close price',
    'avg close price',
    'average close price',
    'closing price',
    'closing avg price',
    'close avg price',
    'цена выхода',
    'цена закрытия',
    'средняя цена закрытия',
  ],
  price: ['price', 'avg price', 'average price', 'fill price', 'filled price', 'execution price', 'exec price', 'trade price', 'deal price', 'цена', 'цена исполнения'],
  quantity: [
    'closed vol',
    'closed qty',
    'closed amount',
    'closed size',
    'qty',
    'quantity',
    'size',
    'filled',
    'filled qty',
    'executed',
    'exec qty',
    'position size',
    'volume',
    'объём',
    'объем',
    'количество',
    'кол во',
    'размер',
    // Last: on Binance fills "Amount" is the value in USDT, used only when nothing else is there.
    'amount',
  ],
  pnl: ['realized pnl', 'realized p&l', 'realised pnl', 'realized profit', 'closed p&l', 'closed pnl', 'closing pnl', 'net pnl', 'pnl', 'profit', 'реализованный pnl', 'pnl закрытия', 'закрытый p&l', 'прибыль'],
  fee: ['fee', 'fees', 'trading fee', 'commission', 'fee paid', 'комиссия'],
  leverage: ['leverage', 'lever', 'плечо'],
  openTime: ['open time', 'opened', 'opening time', 'entry time', 'open date', 'time opened', 'created time', 'create time', 'время открытия', 'время входа', 'открыто'],
  closeTime: ['close time', 'closed', 'closing time', 'exit time', 'close date', 'time closed', 'trade time', 'updated time', 'update time', 'время закрытия', 'закрыто'],
  time: ['date', 'time', 'trade time', 'date time', 'datetime', 'exec time', 'execution time', 'fill time', 'created time', 'дата', 'время'],
}

// Fields that pick a column first: a closing direction must not be taken as the plain side,
// and the specific prices must not be taken as the fill price.
const DETECTION_ORDER: ImportField[] = [
  'symbol',
  'closingSide',
  'positionSide',
  'side',
  'entryPrice',
  'exitPrice',
  'price',
  'pnl',
  'fee',
  'leverage',
  'quantity',
  'openTime',
  'closeTime',
  'time',
]

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[._\-:/]+/g, ' ')
    .replace(/[^\p{L}\p{N}&% ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "BTC-USDT-SWAP", "BTC/USDT", "BTCUSDT Perpetual", "ETHUSDT.P" → "BTCUSDT"… */
export function normalizeSymbol(raw: string): string | undefined {
  const text = raw
    .toUpperCase()
    .replace(/\s+(PERPETUAL|PERP|SWAP)$/, '')
    .replace(/[-_/ ](SWAP|PERP)$/, '')
    .replace(/\.P$/, '')
    .replace(/^[A-Z_]+:/, '')
    .replace(/[-_/ ]/g, '')
  return /^[A-Z0-9]{2,20}$/.test(text) && /[A-Z]/.test(text) ? text : undefined
}

/**
 * A signed amount: "-12.3 USDT" → "-12.3", "1,234.5" → "1234.5". With `decimalComma` (a file
 * separated by semicolons, as European spreadsheets save it) "1,5" is one and a half.
 */
export function parseAmount(raw: string, decimalComma = false): string | undefined {
  let text = raw.trim().replace(/[−–]/g, '-').replace(/\s*[A-Za-z]{2,10}$/, '').replace(/^[A-Za-z]{2,10}\s+/, '')
  const negative = text.startsWith('-')
  text = text.replace(/^[+-]/, '').replace(/[\s ']/g, '')
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
  } else if (text.includes(',')) {
    text = decimalComma || !/^\d{1,3}(,\d{3})+$/.test(text) ? text.replace(',', '.') : text.replace(/,/g, '')
  }
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(text)) return undefined
  const value = new Big(text)
  return (negative && !value.eq(0) ? value.times(-1) : value).toString()
}

type SideValue = { kind: 'direction'; side: Side } | { kind: 'order'; buy: boolean }

/** "Long", "Close Short", "Buy", "SELL", "Лонг", "Покупка"… */
export function parseSideValue(raw: string): SideValue | undefined {
  const text = raw.trim().toLowerCase()
  if (/long|лонг/.test(text)) return { kind: 'direction', side: 'long' }
  if (/short|шорт/.test(text)) return { kind: 'direction', side: 'short' }
  if (/^(buy|bid|b|покупка|купить)$/.test(text)) return { kind: 'order', buy: true }
  if (/^(sell|ask|s|продажа|продать)$/.test(text)) return { kind: 'order', buy: false }
  return undefined
}

interface DateFormat {
  /** Minutes east of UTC stated in the header ("Date(UTC+8)"); local time when missing. */
  offset?: number
  /** "05/10/2026" is 5 October rather than May 10. */
  dayFirst: boolean
}

/** The time zone a header names: "Date(UTC)" → 0, "Trade Time(UTC+8)" → 480. */
export function headerOffset(header: string): number | undefined {
  const match = header.match(/utc\s*(?:([+-])\s*(\d{1,2})(?::?(\d{2}))?)?/i)
  if (!match) return undefined
  if (!match[1]) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0)
  return match[1] === '-' ? -minutes : minutes
}

const NUMERIC_DATE = /^(\d{1,2})([-/.])(\d{1,2})\2(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/
const ISO_LIKE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/

/** Whether a column of "dd/mm/yyyy" or "mm/dd/yyyy" dates puts the day first. */
function dayFirstIn(values: readonly string[]): boolean {
  let separator = ''
  for (const value of values) {
    const match = value.trim().match(NUMERIC_DATE)
    if (!match) continue
    if (Number(match[1]) > 12) return true
    if (Number(match[3]) > 12) return false
    separator = match[2]!
  }
  return separator === '.' || separator === '-'
}

/** An ISO timestamp, or undefined when the text isn't a date. */
export function parseDate(raw: string, format: DateFormat = { dayFirst: false }): string | undefined {
  const text = raw.trim()
  if (/^\d{10}$/.test(text)) return new Date(Number(text) * 1000).toISOString()
  if (/^\d{13}$/.test(text)) return new Date(Number(text)).toISOString()

  let parts: { year: number; month: number; day: number; hour: number; minute: number; second: number; ms: number; zone?: string } | undefined
  const iso = text.match(ISO_LIKE)
  if (iso) {
    parts = {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
      hour: Number(iso[4] ?? 0),
      minute: Number(iso[5] ?? 0),
      second: Number(iso[6] ?? 0),
      ms: Number((iso[7] ?? '0').padEnd(3, '0')),
      zone: iso[8],
    }
  } else {
    const numeric = text.match(NUMERIC_DATE)
    if (!numeric) return undefined
    const [first, second] = [Number(numeric[1]), Number(numeric[3])]
    let hour = Number(numeric[5] ?? 0)
    const meridiem = numeric[8]?.toLowerCase()
    if (meridiem === 'pm' && hour < 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0
    parts = {
      year: Number(numeric[4]),
      month: format.dayFirst ? second : first,
      day: format.dayFirst ? first : second,
      hour,
      minute: Number(numeric[6] ?? 0),
      second: Number(numeric[7] ?? 0),
      ms: 0,
    }
  }
  const { year, month, day, hour, minute, second, ms, zone } = parts
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return undefined

  let time: number
  if (zone) {
    const offset = zone === 'Z' ? 0 : (zone.startsWith('-') ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(-2)))
    time = Date.UTC(year, month - 1, day, hour, minute, second, ms) - offset * 60_000
  } else if (format.offset !== undefined) {
    time = Date.UTC(year, month - 1, day, hour, minute, second, ms) - format.offset * 60_000
  } else {
    time = new Date(year, month - 1, day, hour, minute, second, ms).getTime()
  }
  return Number.isNaN(time) ? undefined : new Date(time).toISOString()
}

const TIME_FIELDS: ImportField[] = ['openTime', 'closeTime', 'time']
const NUMBER_FIELDS: ImportField[] = ['entryPrice', 'exitPrice', 'price', 'quantity', 'pnl', 'fee', 'leverage']
const SIDE_FIELDS: ImportField[] = ['side', 'closingSide', 'positionSide']

/** Whether most of a column's values fit the field. */
function fits(field: ImportField, values: readonly string[], decimalComma: boolean): boolean {
  const filled = values.filter(Boolean).slice(0, 50)
  if (filled.length === 0) return false
  const good = (value: string) => {
    if (field === 'symbol') return normalizeSymbol(value) !== undefined && !/^[\d.,\s+-]+$/.test(value)
    if (SIDE_FIELDS.includes(field)) return parseSideValue(value) !== undefined || (field === 'positionSide' && /^both$/i.test(value))
    if (TIME_FIELDS.includes(field)) return parseDate(value, { dayFirst: true }) !== undefined || parseDate(value) !== undefined
    if (field === 'leverage') return parseAmount(value.replace(/[x×]$/i, ''), decimalComma) !== undefined
    if (NUMBER_FIELDS.includes(field)) return parseAmount(value, decimalComma) !== undefined
    return false
  }
  return filled.filter(good).length >= Math.ceil(filled.length * 0.8)
}

/** Finds each field's column from the headers, checked against the first rows. */
export function detectColumns(headers: readonly string[], rows: readonly string[][], decimalComma = false): ColumnMap {
  const normalized = headers.map(normalizeHeader)
  const used = new Set<number>()
  const columns: ColumnMap = {}
  for (const field of DETECTION_ORDER) {
    for (const synonym of SYNONYMS[field]) {
      const index = normalized.findIndex((header, column) => header === synonym && !used.has(column))
      if (index === -1) continue
      if (!fits(field, rows.map((row) => row[index] ?? ''), decimalComma)) continue
      columns[field] = index
      used.add(index)
      break
    }
  }
  return columns
}

export function shapeOf(columns: ColumnMap): ImportShape | undefined {
  if (columns.symbol === undefined || columns.quantity === undefined) return undefined
  if (columns.entryPrice !== undefined && columns.exitPrice !== undefined) return 'positions'
  const hasTime = columns.time !== undefined || columns.closeTime !== undefined || columns.openTime !== undefined
  if (columns.price !== undefined && columns.side !== undefined && hasTime) return 'fills'
  return undefined
}

const round = (value: Big) => value.round(8).toString()

function tradeKey(trade: Omit<ImportedTrade, 'key'>): string {
  return ['csv', trade.symbol, trade.side, trade.openedAt, trade.closedAt, trade.quantity, trade.entryPrice, trade.exitPrice].join('|')
}

function grossPnl(side: Side, entry: string, exit: string, quantity: string): Big {
  return new Big(exit).minus(entry).times(quantity).times(side === 'long' ? 1 : -1)
}

/** Reads a whole file. `override` replaces detected columns, e.g. after the trader fixed one. */
export function importCsv(text: string, override: ColumnMap = {}): ImportResult {
  const { rows: table, delimiter } = parseCsv(text)
  const [headers = [], ...rows] = table
  const decimalComma = delimiter === ';'
  const columns = { ...detectColumns(headers, rows, decimalComma), ...override }
  const shape = shapeOf(columns)
  const empty: ImportResult = { headers, columns, shape, trades: [], skipped: [], openPositions: 0, pnlMismatch: false }
  if (!shape) return empty

  const cell = (row: readonly string[], field: ImportField) => (columns[field] === undefined ? '' : (row[columns[field]!] ?? '').trim())
  const dateFormats = Object.fromEntries(
    TIME_FIELDS.map((field) => [
      field,
      columns[field] === undefined ? { dayFirst: false } : { offset: headerOffset(headers[columns[field]!] ?? ''), dayFirst: dayFirstIn(rows.map((row) => row[columns[field]!] ?? '')) },
    ]),
  ) as Record<ImportField, DateFormat>
  const date = (row: readonly string[], field: ImportField) => (cell(row, field) ? parseDate(cell(row, field), dateFormats[field]) : undefined)
  const amount = (row: readonly string[], field: ImportField) => (cell(row, field) ? parseAmount(cell(row, field), decimalComma) : undefined)

  const result = shape === 'positions' ? positionsFrom(rows, { cell, date, amount }) : fillsFrom(rows, { cell, date, amount })
  const checked = result.trades.filter((trade) => trade.realizedPnl !== undefined && !new Big(trade.realizedPnl).eq(0))
  const mismatched = checked.filter((trade) => {
    const gross = grossPnl(trade.side, trade.entryPrice, trade.exitPrice, trade.quantity)
    const ratio = gross.eq(0) ? 0 : Number(new Big(trade.realizedPnl!).div(gross).toFixed(4))
    return ratio < 0.5 || ratio > 2
  })
  return { ...empty, ...result, pnlMismatch: checked.length > 0 && mismatched.length > checked.length / 2 }
}

interface Readers {
  cell: (row: readonly string[], field: ImportField) => string
  date: (row: readonly string[], field: ImportField) => string | undefined
  amount: (row: readonly string[], field: ImportField) => string | undefined
}

type Rebuilt = Pick<ImportResult, 'trades' | 'skipped' | 'openPositions'>

/** One row per closed position. */
function positionsFrom(rows: readonly string[][], { cell, date, amount }: Readers): Rebuilt {
  const trades: ImportedTrade[] = []
  const skipped: ImportResult['skipped'] = []
  rows.forEach((row, index) => {
    const skip = (reason: SkipReason) => skipped.push({ row: index + 1, reason })
    const symbol = normalizeSymbol(cell(row, 'symbol'))
    const entryPrice = amount(row, 'entryPrice')
    const exitPrice = amount(row, 'exitPrice')
    const quantity = amount(row, 'quantity')
    if (!symbol || !cell(row, 'entryPrice') || !cell(row, 'exitPrice') || !cell(row, 'quantity')) return skip('missingValue')
    if (!entryPrice || !exitPrice || !quantity || new Big(quantity).eq(0)) return skip('badNumber')
    const pnl = amount(row, 'pnl')

    let side: Side | undefined
    const direction = parseSideValue(cell(row, 'side'))
    const closing = parseSideValue(cell(row, 'closingSide'))
    const position = parseSideValue(cell(row, 'positionSide'))
    if (direction) side = direction.kind === 'direction' ? direction.side : direction.buy ? 'long' : 'short'
    else if (closing) side = closing.kind === 'direction' ? closing.side : closing.buy ? 'short' : 'long'
    else if (position?.kind === 'direction') side = position.side
    else if (pnl && !new Big(pnl).eq(0) && !new Big(exitPrice).eq(entryPrice)) {
      // No side column: the side whose price move gives the printed PnL's sign.
      side = new Big(pnl).gt(0) === new Big(exitPrice).gt(entryPrice) ? 'long' : 'short'
    }
    if (!side) return skip('badSide')

    const opened = date(row, 'openTime') ?? date(row, 'time')
    const closed = date(row, 'closeTime') ?? date(row, 'time')
    if (!opened && !closed) return skip('badDate')
    const size = new Big(quantity).abs().toString()

    let fees = '0'
    const fee = amount(row, 'fee')
    if (fee) fees = new Big(fee).abs().toString()
    else if (pnl) {
      // No fee column: whatever separates the price move from the exchange's PnL is costs.
      const costs = grossPnl(side, entryPrice, exitPrice, size).minus(pnl)
      if (costs.gt(0)) fees = round(costs)
    }
    const leverage = cell(row, 'leverage') ? parseAmount(cell(row, 'leverage').replace(/[x×]$/i, '')) : undefined

    const trade = {
      symbol,
      side,
      entryPrice,
      exitPrice,
      quantity: size,
      fees,
      leverage: leverage && new Big(leverage).gt(0) ? leverage : undefined,
      openedAt: opened ?? closed!,
      closedAt: closed ?? opened!,
      realizedPnl: pnl,
    }
    trades.push({ ...trade, key: tradeKey(trade) })
  })
  return { trades, skipped, openPositions: 0 }
}

interface Fill {
  row: number
  symbol: string
  group: string
  buy: boolean
  price: Big
  quantity: Big
  fee: Big
  pnl?: Big
  time: string
}

/** Fills rebuilt into round trips: a trade opens when a symbol's position leaves zero and closes when it returns. */
function fillsFrom(rows: readonly string[][], { cell, date, amount }: Readers): Rebuilt {
  const skipped: ImportResult['skipped'] = []
  const fills: Fill[] = []
  rows.forEach((row, index) => {
    const skip = (reason: SkipReason) => skipped.push({ row: index + 1, reason })
    const symbol = normalizeSymbol(cell(row, 'symbol'))
    if (!symbol || !cell(row, 'price') || !cell(row, 'quantity')) return skip('missingValue')
    const price = amount(row, 'price')
    const quantity = amount(row, 'quantity')
    if (!price || !quantity || new Big(quantity).eq(0)) return skip('badNumber')
    const side = parseSideValue(cell(row, 'side'))
    if (!side) return skip('badSide')
    // "Open Long" buys, "Close Long" sells; plain "Long"/"Short" are taken as opening.
    const closing = /close|закр/i.test(cell(row, 'side'))
    const buy = side.kind === 'order' ? side.buy : (side.side === 'long') !== closing
    const time = date(row, 'time') ?? date(row, 'closeTime') ?? date(row, 'openTime')
    if (!time) return skip('badDate')
    const position = parseSideValue(cell(row, 'positionSide'))
    const fee = amount(row, 'fee')
    const pnl = amount(row, 'pnl')
    fills.push({
      row: index + 1,
      symbol,
      // In hedge mode a symbol holds a long and a short position at once: follow each apart.
      group: position?.kind === 'direction' ? `${symbol}|${position.side}` : symbol,
      buy,
      price: new Big(price),
      quantity: new Big(quantity).abs(),
      fee: fee ? new Big(fee).abs() : new Big(0),
      pnl: pnl ? new Big(pnl) : undefined,
      time,
    })
  })
  fills.sort((a, b) => a.time.localeCompare(b.time) || a.row - b.row)

  interface Open {
    side: Side
    size: Big
    opened: Big
    entryValue: Big
    closed: Big
    exitValue: Big
    fees: Big
    pnl?: Big
    openedAt: string
  }
  const positions = new Map<string, Open>()
  const trades: ImportedTrade[] = []

  const finish = (symbol: string, open: Open, closedAt: string) => {
    const trade = {
      symbol,
      side: open.side,
      entryPrice: round(open.entryValue.div(open.opened)),
      exitPrice: round(open.exitValue.div(open.closed)),
      quantity: round(open.opened),
      fees: round(open.fees),
      openedAt: open.openedAt,
      closedAt,
      realizedPnl: open.pnl ? round(open.pnl) : undefined,
    }
    trades.push({ ...trade, key: tradeKey(trade) })
  }

  for (const fill of fills) {
    let remaining = fill.quantity
    let feeLeft = fill.fee
    while (remaining.gt(0)) {
      const open = positions.get(fill.group)
      if (!open || open.size.eq(0)) {
        positions.set(fill.group, {
          side: fill.buy ? 'long' : 'short',
          size: remaining,
          opened: remaining,
          entryValue: fill.price.times(remaining),
          closed: new Big(0),
          exitValue: new Big(0),
          fees: feeLeft,
          openedAt: fill.time,
        })
        remaining = new Big(0)
      } else if ((open.side === 'long') === fill.buy) {
        open.size = open.size.plus(remaining)
        open.opened = open.opened.plus(remaining)
        open.entryValue = open.entryValue.plus(fill.price.times(remaining))
        open.fees = open.fees.plus(feeLeft)
        remaining = new Big(0)
      } else {
        // Closing: up to the open size; anything beyond flips into a new position.
        const closing = remaining.gt(open.size) ? open.size : remaining
        const closingFee = fill.fee.times(closing).div(fill.quantity)
        open.size = open.size.minus(closing)
        open.closed = open.closed.plus(closing)
        open.exitValue = open.exitValue.plus(fill.price.times(closing))
        open.fees = open.fees.plus(closingFee)
        // A fill closes at most one position (any rest opens the next), so its PnL is that position's.
        if (fill.pnl && remaining.eq(fill.quantity)) open.pnl = (open.pnl ?? new Big(0)).plus(fill.pnl)
        feeLeft = feeLeft.minus(closingFee)
        remaining = remaining.minus(closing)
        if (open.size.eq(0)) {
          finish(fill.symbol, open, fill.time)
          positions.delete(fill.group)
        }
      }
    }
  }
  const openPositions = [...positions.values()].filter((open) => open.size.gt(0)).length
  return { trades, skipped, openPositions }
}
