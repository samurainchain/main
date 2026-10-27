import Big from 'big.js'
import type { Side } from '../models'
import { tradePnl } from '../pnl'

// ScreenshotParser (SPEC sections 4.4 and 7): turns the text recognized on an exchange
// screenshot into trade fields. It reads labels in English or Russian ("Entry Price",
// "Цена входа", "Avg. Close Price", "Qty"…)
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
// Russian patterns use \p{L} instead of \b, which only knows Latin letters.
const LABELS: { field: NumericField; pattern: RegExp }[] = [
  { field: 'pnl', pattern: /closing pnl|closed p&l|closed pnl|realized p&l|realized pnl|realised pnl|net profit|\bprofit\b|\bpnl\b/i },
  {
    field: 'pnl',
    pattern: /закрыт(?:ый|ая)\s*(?:p&l|pnl)|(?:p&l|pnl)\s*закрытия|реализованн(?:ый|ая)\s*(?:p&l|pnl|прибыль)|чистая прибыль|(?<!\p{L})прибыль(?!\p{L})/iu,
  },
  { field: 'exitPrice', pattern: /avg\.?\s*close price|average close price|avg\.?\s*exit price|close price|closing price|exit price/i },
  { field: 'exitPrice', pattern: /(?:ср(?:едн(?:яя)?)?\.?\s*)?цена\s*(?:закрытия|выхода)|выходн(?:ая|ой)\s*цена/iu },
  { field: 'entryPrice', pattern: /avg\.?\s*entry price|average entry price|entry price|avg\.?\s*open price|open price|opening price|avg\.?\s*fill price/i },
  { field: 'entryPrice', pattern: /(?:ср(?:едн(?:яя)?)?\.?\s*)?цена\s*(?:входа|открытия|исполнения)|входн(?:ая|ой)\s*цена/iu },
  { field: 'quantity', pattern: /closed vol\.?|closed amount|closed qty|max open interest|position size|\bqty\b|quantity|\bsize\b|contracts|\bamount\b/i },
  {
    field: 'quantity',
    pattern:
      /объ[её]м\s*закрытия|закрытый\s*объ[её]м|закрыт(?:ая|ое)\s*(?:сумма|кол-во|количество)|размер\s*позиции|макс\.?\s*открытый\s*интерес|кол-?во|количество|(?<!\p{L})(?:размер|объ[её]м)(?!\p{L})|контракт(?:ы|ов)?(?!\p{L})/iu,
  },
]

// Words of a Russian exchange interface. A stray Cyrillic letter (OCR reading "Avg." as "Ауд.")
// must not switch an English screenshot to Russian number format.
const RUSSIAN_INTERFACE = /цена|закры|объ[её]м|кол-?во|количеств|лонг|шорт|кросс|бессрочн|прибыль|сумма|размер|плечо/i
// Letters that look alike in Latin and Cyrillic. With both models loaded, OCR mixes them up
// inside a word: "Цeнa" with Latin e and a, or "BTCUSDТ" with a Cyrillic Т.
const LATIN_LOOKALIKES = 'aceopxyABCEHKMOPTX'
const CYRILLIC_LOOKALIKES = 'асеорхуАВСЕНКМОРТХ'

/**
 * Writes each word in one alphabet: the one its unambiguous letters (ц, д, U, S…) belong to,
 * or, when it has none or both, the one most of its letters are in.
 */
function fixMixedScripts(line: string): string {
  const count = (word: string, letters: RegExp, lookalikes: string) => {
    const all = word.match(letters) ?? []
    return { all: all.length, own: all.filter((letter) => !lookalikes.includes(letter)).length }
  }
  return line.replace(/\S+/g, (word) => {
    const cyrillic = count(word, /[а-яё]/gi, CYRILLIC_LOOKALIKES)
    const latin = count(word, /[a-z]/gi, LATIN_LOOKALIKES)
    if (cyrillic.all === 0 || latin.all === 0) return word
    const toCyrillic = cyrillic.own > 0 !== latin.own > 0 ? cyrillic.own > 0 : cyrillic.all >= latin.all
    const [from, to] = toCyrillic ? [LATIN_LOOKALIKES, CYRILLIC_LOOKALIKES] : [CYRILLIC_LOOKALIKES, LATIN_LOOKALIKES]
    return [...word].map((letter) => (from.includes(letter) ? to[from.indexOf(letter)]! : letter)).join('')
  })
}

/** OCR slips that turn digits into look-alike letters inside numbers ("6O,OOO", "S7,147"). */
function fixDigits(token: string): string {
  return token.replace(/^([+\-−–]?)S(?=\d)/, '$15').replace(/[Oo]/g, '0').replace(/[Il|]/g, '1')
}

/**
 * Normalizes one printed number: "61,234.50" → "61234.50", "61.234,5" → "61234.5",
 * "0,25" → "0.25". The sign is dropped; direction comes from the side. With `decimalComma`
 * (a Russian interface) "1,500" is one and a half, not fifteen hundred; "0,100" always is.
 */
export function normalizeNumber(raw: string, decimalComma = false): string | undefined {
  let text = fixDigits(raw.trim()).replace(/^[+\-−–]/, '')
  // OCR drops small decimal marks: "0,1467" comes back as "01467". No amount starts with 0.
  if (/^0\d+$/.test(text)) text = `0.${text.slice(1)}`
  if (/^\d{1,3},\d{3}$/.test(text) && (decimalComma || text.startsWith('0'))) text = text.replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, '')
  else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(text)) text = text.replace(/\./g, '').replace(',', '.')
  else if (/^\d+,\d+$/.test(text)) text = text.replace(',', '.')
  return /^\d+(\.\d+)?$/.test(text) ? text : undefined
}

interface PrintedNumber {
  value: string
  unit: string
}

/**
 * Joins digit groups split by spaces, as Russian and other locales print thousands:
 * "62 487,50" → "62487,50" anywhere; "1 000" only in a Russian interface, because in an
 * English table row two short columns ("3 150") could otherwise merge.
 */
function joinDigitGroups(line: string, russian: boolean): string {
  const join = (match: string) => match.replace(/\s/g, '')
  const withComma = line.replace(/(?<![\d.,])\d{1,3}(?:\s\d{3})+,\d+/g, join)
  if (!russian) return withComma
  // A last group longer than three digits lost its decimal comma: "61 3911" is "61 391,1".
  const restored = withComma.replace(/(?<![\d.,])\d{1,3}(?:\s\d{3})*\s\d{4,}(?![\d.,])/g, (match) => {
    const digits = join(match)
    const last = match.slice(match.lastIndexOf(' ') + 1)
    return `${digits.slice(0, digits.length - last.length + 3)},${last.slice(3)}`
  })
  return restored.replace(/(?<![\d.,])\d{1,3}(?:\s\d{3})+(?!\d)/g, join)
}

/**
 * Numbers on a line with the word right after each ("0.100 BTC", "20x", "41.2%").
 * `russian`: the screenshot has Russian words, so spaces group thousands and commas are decimal.
 */
function numbersIn(line: string, russian: boolean): PrintedNumber[] {
  const withoutTimes = line.replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{1,2}:\d{2}(:\d{2})?/g, ' ')
  const grouped = joinDigitGroups(withoutTimes, russian)
  const results: PrintedNumber[] = []
  // A leading "S" right before digits is a misread 5, unless it ends a word ("USDT 5").
  for (const match of grouped.matchAll(/([+\-−–]?(?:(?<![A-Za-z])S(?=\d))?[\dOo][\d,.Oo]*)\s*([A-Za-zА-Яа-яЁё%×]*)/g)) {
    if (!/\d/.test(match[1]!)) continue
    const value = normalizeNumber(match[1]!.replace(/[.,]$/, ''), russian)
    if (value !== undefined) results.push({ value, unit: match[2]!.toUpperCase() })
  }
  return results
}

/** A number usable as a price, size or PnL: not a percentage and not leverage. */
const isAmount = (item: PrintedNumber) => !['%', 'X', '×', 'Х'].includes(item.unit)

function cleanLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => fixMixedScripts(line.replace(/[|¦]/g, ' ').replace(/\s+/g, ' ').trim()))
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
  // "Покупка", "Закрыть продажу", "Закрытие (продажа)"; "closing" only on the same line.
  const russian = text.match(/(закры\p{L}*[ \t]*\(?)?(покупк|купить|продаж|продать)/iu)
  if (russian) {
    const closing = Boolean(russian[1])
    const buy = /^(покупк|купить)$/i.test(russian[2]!)
    return { value: buy !== closing ? 'long' : 'short', confidence: 'low' }
  }
  return undefined
}

function findLeverage(text: string): Recognized<string> | undefined {
  const match = text.match(/(?<![\d.,])(\d{1,3})\s?[xX×хХ](?![A-Za-zА-Яа-яЁё])/)
  if (!match) return undefined
  const value = Number(match[1])
  return value >= 1 && value <= 125 ? { value: String(value), confidence: 'high' } : undefined
}

/** Labels on a line, left to right, without overlaps. */
function labelsIn(line: string): { field: NumericField; start: number; end: number }[] {
  const found: { field: NumericField; start: number; end: number }[] = []
  for (const { field, pattern } of LABELS) {
    for (const match of line.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
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
  const russian = RUSSIAN_INTERFACE.test(joined)
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
    if (labels.length >= 2 && numbersIn(line, russian).filter(isAmount).length === 0 && next && !nextIsLabels) {
      const values = numbersIn(next, russian).filter(isAmount)
      if (values.length === labels.length) labels.forEach((label, column) => assign(label.field, values[column]!, 'low'))
      return
    }

    // "Label value" pairs on one line, or a single label with its value on the next line.
    labels.forEach((label, position) => {
      const until = labels[position + 1]?.start ?? line.length
      const own = numbersIn(line.slice(label.end, until), russian).find(isAmount)
      const below = labels.length === 1 && !nextIsLabels && next ? numbersIn(next, russian).find(isAmount) : undefined
      const item = own ?? below
      if (item) assign(label.field, item, base)
    })
  })

  // Share cards (OKX, Binance) print the PnL as a bare amount under the ROI, with no label.
  if (!result.pnl) {
    const bare = lines.find((line) => labelsIn(line).length === 0 && /^[+\-−–]?\d[\d\s.,]*\s?[A-Z]{3,5}$/.test(line))
    const amount = bare ? numbersIn(bare, russian).find((item) => QUOTES.includes(item.unit)) : undefined
    if (amount) result.pnl = { value: amount.value, confidence: 'low' }
  }

  return deriveQuantity(crossCheck(alignPrices(result)))
}

/**
 * Share cards show prices and PnL but not the size. Without fees the PnL is the price move times
 * the size, so the size follows from them; it is approximate, so it is left for the user to check.
 */
function deriveQuantity(result: ParsedScreenshot): ParsedScreenshot {
  const { quantity, pnl, entryPrice, exitPrice } = result
  if (quantity || !pnl || !entryPrice || !exitPrice) return result
  const move = new Big(exitPrice.value).minus(entryPrice.value).abs()
  if (move.eq(0)) return result
  const value = new Big(pnl.value).div(move).round(4).toString()
  return { ...result, quantity: { value, confidence: 'low' }, quantityUnit: 'base' }
}

/**
 * Entry and exit of one trade are never an order of magnitude apart. When they are and one of
 * them is a whole number, OCR lost its decimal mark ("613911" for "61 391,1"): shift it to
 * the other price's magnitude and leave it for the user to check.
 */
function alignPrices(result: ParsedScreenshot): ParsedScreenshot {
  const { entryPrice, exitPrice } = result
  if (!entryPrice || !exitPrice) return result
  const ratio = Number(entryPrice.value) / Number(exitPrice.value)
  if (!Number.isFinite(ratio) || ratio === 0 || (ratio < 5 && ratio > 0.2)) return result
  const [field, other] = ratio > 1 ? (['entryPrice', exitPrice] as const) : (['exitPrice', entryPrice] as const)
  const digits = result[field]!.value
  const shift = Math.round(Math.log10(Number(digits) / Number(other.value)))
  if (digits.includes('.') || shift < 1 || shift >= digits.length) return result
  const value = `${digits.slice(0, digits.length - shift)}.${digits.slice(digits.length - shift)}`
  const close = Number(value) / Number(other.value)
  return close < 2 && close > 0.5 ? { ...result, [field]: { value, confidence: 'low' } } : result
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
