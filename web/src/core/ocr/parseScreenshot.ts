import Big from 'big.js'
import type { Side } from '../models'
import { tradePnl } from '../pnl'

// ScreenshotParser (SPEC sections 4.4 and 7): turns the text recognized on an exchange
// screenshot into trade fields. It reads labels ("Entry Price", "Avg. Close Price", "Qty"…)
// rather than positions, so it copes with layouts it hasn't seen as long as the wording is
// familiar. Two layouts are understood: "label value" (or label above value) as on phone
// screens, and a table header followed by a row of values as on desktop terminals.
// Every field carries a confidence; low ones are highlighted for the user to check.

export type Confidence = 'high' | 'low'
export type Exchange = 'binance' | 'okx' | 'bybit' | 'tradingview'

export interface Recognized<T> {
  value: T
  confidence: Confidence
}

export interface ParsedScreenshot {
  exchange?: Exchange
  symbol?: Recognized<string>
  side?: Recognized<Side>
  entryPrice?: Recognized<string>
  exitPrice?: Recognized<string>
  quantity?: Recognized<string>
  /** Whether the size was given in coins (`base`) or in the quote currency (`quote`). */
  quantityUnit?: 'base' | 'quote'
  leverage?: Recognized<string>
  /** Realized PnL printed on the screenshot, used to cross-check the other fields. */
  pnl?: Recognized<string>
}

type NumericField = 'entryPrice' | 'exitPrice' | 'quantity' | 'pnl'

const QUOTES = ['USDT', 'USDC', 'BUSD', 'FDUSD', 'USD']

// More specific labels first: "Avg. Close Price" must not be read as an entry "Price".
const LABELS: { field: NumericField; pattern: RegExp }[] = [
  { field: 'pnl', pattern: /closing pnl|closed p&l|closed pnl|realized p&l|realized pnl|realised pnl|net profit|\bprofit\b|\bpnl\b/i },
  { field: 'exitPrice', pattern: /avg\.?\s*close price|average close price|avg\.?\s*exit price|close price|closing price|exit price/i },
  { field: 'entryPrice', pattern: /avg\.?\s*entry price|average entry price|entry price|avg\.?\s*open price|open price|opening price|avg\.?\s*fill price/i },
  { field: 'quantity', pattern: /closed vol\.?|closed amount|closed qty|max open interest|position size|\bqty\b|quantity|\bsize\b|contracts|\bamount\b/i },
]

/** OCR slips that turn digits into look-alike letters inside numbers ("6O,OOO", "S7,147"). */
function fixDigits(token: string): string {
  return token.replace(/^([+\-−–]?)S(?=\d)/, '$15').replace(/[Oo]/g, '0').replace(/[Il|]/g, '1')
}

/**
 * Normalizes one printed number: "61,234.50" → "61234.50", "61.234,5" → "61234.5",
 * "0,25" → "0.25". The sign is dropped; direction comes from the side.
 */
export function normalizeNumber(raw: string): string | undefined {
  let text = fixDigits(raw.trim()).replace(/^[+\-−–]/, '')
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, '')
  else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(text)) text = text.replace(/\./g, '').replace(',', '.')
  else if (/^\d+,\d+$/.test(text)) text = text.replace(',', '.')
  return /^\d+(\.\d+)?$/.test(text) ? text : undefined
}

interface PrintedNumber {
  value: string
  unit: string
}

/** Numbers on a line with the word right after each ("0.100 BTC", "20x", "41.2%"). */
function numbersIn(line: string): PrintedNumber[] {
  const withoutTimes = line.replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{1,2}:\d{2}(:\d{2})?/g, ' ')
  const results: PrintedNumber[] = []
  // A leading "S" right before digits is a misread 5, unless it ends a word ("USDT 5").
  for (const match of withoutTimes.matchAll(/([+\-−–]?(?:(?<![A-Za-z])S(?=\d))?[\dOo][\d,.Oo]*)\s*([A-Za-z%×]*)/g)) {
    if (!/\d/.test(match[1]!)) continue
    const value = normalizeNumber(match[1]!.replace(/[.,]$/, ''))
    if (value !== undefined) results.push({ value, unit: match[2]!.toUpperCase() })
  }
  return results
}

/** A number usable as a price, size or PnL: not a percentage and not leverage. */
const isAmount = (item: PrintedNumber) => item.unit !== '%' && item.unit !== 'X' && item.unit !== '×'

function cleanLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[|¦]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function detectExchange(text: string): Exchange | undefined {
  if (/tradingview|\b[A-Z_]{3,}:[A-Z0-9]+/i.test(text)) return 'tradingview'
  if (/\bbybit\b|closed p&l/i.test(text)) return 'bybit'
  if (/\bokx\b|-SWAP\b|realized pnl/i.test(text)) return 'okx'
  if (/binance|closing pnl|perpetual/i.test(text)) return 'binance'
  return undefined
}

function findSymbol(lines: readonly string[]): Recognized<string> | undefined {
  for (const line of lines) {
    // TradingView: "BINANCE:BTCUSDT", "BYBIT:ETHUSDT.P", "CME_MINI:ES1!" → BTCUSDT, ETHUSDT, ES
    const tv = line.match(/\b[A-Z_]{3,}:([A-Z0-9]{1,12}?)(?:\.P|\d!)?(?=\s|$)/)
    if (tv) return { value: tv[1]!, confidence: 'high' }
    // OKX "BTC-USDT-SWAP", "BTC/USDT"; Binance and Bybit "BTCUSDT", "BTCUSDT Perpetual"
    const pair = line.match(new RegExp(`\\b([A-Z0-9]{2,12}?)[-/ ]?(${QUOTES.join('|')})(?:[-/ ]?(?:SWAP|PERP))?\\b`))
    if (pair) return { value: `${pair[1]}${pair[2]}`, confidence: 'high' }
  }
  return undefined
}

function findSide(text: string): Recognized<Side> | undefined {
  // "Long 20x", "Close Long", "Closed Short", "Entry Long"
  const explicit = text.match(/\b(long|short)\b|лонг|шорт/i)
  if (explicit) {
    const word = explicit[0].toLowerCase()
    return { value: word === 'long' || word === 'лонг' ? 'long' : 'short', confidence: 'high' }
  }
  // Only buy/sell printed: an opening buy is a long, a closing sell is a long too.
  const buySell = text.match(/\b(close|closing|exit)?\s*(buy|sell)\b/i)
  if (buySell) {
    const closing = Boolean(buySell[1])
    const buy = buySell[2]!.toLowerCase() === 'buy'
    return { value: buy !== closing ? 'long' : 'short', confidence: 'low' }
  }
  return undefined
}

function findLeverage(text: string): Recognized<string> | undefined {
  const match = text.match(/\b(\d{1,3})\s?[xX×](?![A-Za-z])/)
  if (!match) return undefined
  const value = Number(match[1])
  return value >= 1 && value <= 125 ? { value: String(value), confidence: 'high' } : undefined
}

/** Labels on a line, left to right, without overlaps. */
function labelsIn(line: string): { field: NumericField; start: number; end: number }[] {
  const found: { field: NumericField; start: number; end: number }[] = []
  for (const { field, pattern } of LABELS) {
    for (const match of line.matchAll(new RegExp(pattern.source, 'gi'))) {
      const start = match.index
      const end = start + match[0].length
      if (found.some((item) => start < item.end && end > item.start)) continue
      found.push({ field, start, end })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}

export function parseScreenshotText(text: string, ocrConfidence = 100): ParsedScreenshot {
  const lines = cleanLines(text)
  const joined = lines.join('\n')
  const base: Confidence = ocrConfidence >= 75 ? 'high' : 'low'
  const result: ParsedScreenshot = {
    exchange: detectExchange(joined),
    symbol: findSymbol(lines),
    side: findSide(joined),
    leverage: findLeverage(joined),
  }

  const assign = (field: NumericField, item: PrintedNumber, confidence: Confidence) => {
    if (result[field]) return
    result[field] = { value: item.value, confidence }
    if (field === 'quantity') result.quantityUnit = QUOTES.includes(item.unit) ? 'quote' : 'base'
  }

  lines.forEach((line, index) => {
    const labels = labelsIn(line)
    if (labels.length === 0) return
    const next = lines[index + 1]
    const nextIsLabels = next !== undefined && labelsIn(next).length > 0

    // Table header: several labels and no numbers of their own; the next row holds the values
    // in the same order. Used only when the counts match, so stray columns can't shift values.
    if (labels.length >= 2 && numbersIn(line).filter(isAmount).length === 0 && next && !nextIsLabels) {
      const values = numbersIn(next).filter(isAmount)
      if (values.length === labels.length) labels.forEach((label, column) => assign(label.field, values[column]!, 'low'))
      return
    }

    // "Label value" pairs on one line, or a single label with its value on the next line.
    labels.forEach((label, position) => {
      const until = labels[position + 1]?.start ?? line.length
      const own = numbersIn(line.slice(label.end, until)).find(isAmount)
      const below = labels.length === 1 && !nextIsLabels && next ? numbersIn(next).find(isAmount) : undefined
      const item = own ?? below
      if (item) assign(label.field, item, base)
    })
  })

  return crossCheck(result)
}

/**
 * When the screenshot prints a PnL, recompute it from the recognized fields: a match within
 * 3% (fees explain the rest) confirms side, prices and size.
 */
function crossCheck(result: ParsedScreenshot): ParsedScreenshot {
  const { pnl, side, entryPrice, exitPrice, quantity } = result
  if (!pnl || !side || !entryPrice || !exitPrice || !quantity || result.quantityUnit === 'quote') return result
  const computed = tradePnl({ side: side.value, entryPrice: entryPrice.value, exitPrice: exitPrice.value, quantity: quantity.value, contractMultiplier: '1', fees: '0' })
  if (!computed || computed.eq(0)) return result
  const close = computed.abs().minus(new Big(pnl.value)).abs().lte(computed.abs().times(0.03))
  if (!close) return result
  const confirm = <T,>(field: Recognized<T>): Recognized<T> => ({ ...field, confidence: 'high' })
  return { ...result, side: confirm(side), entryPrice: confirm(entryPrice), exitPrice: confirm(exitPrice), quantity: confirm(quantity) }
}
