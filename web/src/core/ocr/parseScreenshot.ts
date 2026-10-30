import Big from 'big.js'
import type { Side } from '../models'
import { tradePnl } from '../pnl'

// ScreenshotParser (SPEC sections 4.4 and 7): turns the text recognized on an exchange
// screenshot into trade fields. It reads labels in English or Russian ("Entry Price",
// "Цена входа", "Avg. Close Price", "Qty"…)
// rather than positions, so it copes with layouts it hasn't seen as long as the wording is
// familiar. Two layouts are understood: "label value" (or label above value) as on phone
// screens, and a table header followed by a row of values as on desktop terminals. A position
// screen with its order history ("Open long … fill price", "Close long … fill price") takes the
// entry from the opening order and the exit from the closing one.
// Every field carries a confidence; low ones are highlighted for the user to check.

export type Confidence = 'high' | 'low'
export type Exchange = 'binance' | 'okx' | 'bybit' | 'bingx' | 'tradingview'

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
  /** Trading fees for the whole trade, in the quote currency. Funding is left out. */
  fees?: Recognized<string>
  /** When the position was opened and closed, as `datetime-local` values ("2026-10-26T11:39"). */
  openedAt?: Recognized<string>
  closedAt?: Recognized<string>
  /** The ROI a share card prints, in percent ("293.42"), used to check the prices. */
  roi?: string
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
  {
    field: 'pnl',
    // Spanish: "PNL de cierre", "P&L cerrado", "PnL realizado", "Ganancia neta"
    pattern: /(?:pnl|p&l)\s*(?:de\s*|al\s*)?(?:cierre|cerrad[oa]|realizad[oa])|ganancia\s*neta|(?<!\p{L})ganancias?(?!\p{L})/iu,
  },
  { field: 'exitPrice', pattern: /avg\.?\s*close price|average close price|avg\.?\s*exit price|close price|closing price|exit price/i },
  { field: 'exitPrice', pattern: /precio\s*(?:prom(?:edio|\.)?\s*)?(?:de\s*)?(?:cierre|salida)(?:\s*prom(?:edio|\.)?)?/iu },
  { field: 'exitPrice', pattern: /(?:ср(?:едн(?:яя)?)?\.?\s*)?цена\s*(?:закрытия|выхода)|выходн(?:ая|ой)\s*цена/iu },
  { field: 'entryPrice', pattern: /avg\.?\s*entry price|average entry price|entry price|avg\.?\s*open price|open price|opening price|avg\.?\s*fill price/i },
  { field: 'entryPrice', pattern: /(?:ср(?:едн(?:яя)?)?\.?\s*)?цена\s*(?:входа|открытия|исполнения)|входн(?:ая|ой)\s*цена/iu },
  { field: 'entryPrice', pattern: /precio\s*(?:prom(?:edio|\.)?\s*)?(?:de\s*)?(?:entrada|apertura)(?:\s*prom(?:edio|\.)?)?/iu },
  { field: 'quantity', pattern: /closed vol\.?|closed amount|closed qty|max open interest|position size|\bqty\b|quantity|\bsize\b|contracts|\bamount\b/i },
  {
    field: 'quantity',
    pattern:
      /объ[её]м\s*закрытия|закрытый\s*объ[её]м|закрыт(?:ая|ое)\s*(?:сумма|кол-во|количество)|размер\s*позиции|макс\.?\s*открытый\s*интерес|кол-?во|количество|(?<!\p{L})(?:размер|объ[её]м)(?!\p{L})|контракт(?:ы|ов)?(?!\p{L})/iu,
  },
  {
    field: 'quantity',
    // Spanish: "Vol. cerrado", "Cantidad cerrada", "Monto cerrado", "Tamaño de la posición", "Cant."
    pattern:
      /vol(?:umen|\.)?\s*(?:de\s*)?(?:cierre|cerrad[oa])|(?:cantidad|monto|importe)\s*cerrad[oa]|tama.o\s*de\s*(?:la\s*)?posici.n|(?<!\p{L})cant(?:idad|\.)|(?<!\p{L})contratos(?!\p{L})/iu,
  },
]

// Fees: the trade's total first; per-order fees are added up when there is no total. Funding
// ("Funding fee", "Комиссия за финансирование") can be paid or received, so it is never a fee here.
const TOTAL_FEE =
  /trading fees?|total fees?|торгов(?:ая|ые)\s*комисси[яи]|комисси[яи]\s*за\s*торговлю|итого\s*комисси[яи]|comisi.n(?:es)?\s*de\s*(?:trading|negociaci.n|operaci.n)|comisiones\s*totales/iu
const FUNDING = /funding|финансировани|financiaci|fondeo/iu
const ORDER_FEE = /(?<!\p{L})(?:fees?|commission|комисси[яи]|comisi.n|tarifa)(?!\p{L})/iu

// An order in a position's history: "Open long", "Закрыть шорт". Inside one, the fill price is
// the entry or the exit, and "Filled" is the order's value in the quote currency.
const ORDER_SECTION = /^(?:(open(?:ing)?|открыть|открытие|abrir|apertura)|(close|closing|закрыть|закрытие|cerrar|cierre))\s+(?:long|short|лонг|шорт|largo|corto)(?!\p{L})/iu
const FILL_PRICE =
  /avg\.?\s*fill\s*price|fill(?:ed)?\s*price|order\s*price|avg\.?\s*price|цена\s*[з3]ап(?:олнения|\.)?|цена\s*исполнения|ср(?:едняя)?\.?\s*цена(?!\s*(?:входа|выхода|открытия|закрытия))|precio\s*(?:prom(?:edio|\.)?\s*)?(?:de\s*)?ejec(?:uci.n|\.)?|precio\s*prom(?:edio|\.)?(?!\s*(?:de\s*)?(?:entrada|salida|apertura|cierre))/iu
const FILLED_VALUE = /^(?:filled(?:\s*value)?|executed|исполнено|исполненная\s*сумма|ejecutado|completado|importe\s*ejecutado)(?!\p{L})/iu

// Open and close times: a label with a date on the same line or the next one.
const OPENED_AT =
  /opened|open(?:ing)?\s*time|time\s*opened|время\s*открытия|дата\s*открытия|(?<!\p{L})открыт[оа]?(?!\p{L})|(?:hora|fecha)\s*de\s*apertura|(?<!\p{L})abiert[oa](?!\p{L})/iu
const CLOSED_AT =
  /closed|clos(?:e|ing)\s*time|time\s*closed|время\s*закрытия|дата\s*закрытия|(?<!\p{L})закрыт[оа]?(?!\p{L})|(?:hora|fecha)\s*de\s*cierre|(?<!\p{L})cerrad[oa](?!\p{L})/iu

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
  if (/\bbing\s?x\b/i.test(text)) return 'bingx'
  if (/\bbybit\b|closed p&l|p&l cerrado/i.test(text)) return 'bybit'
  if (/\bokx\b|-SWAP\b|realized pnl/i.test(text)) return 'okx'
  if (/binance|closing pnl|perpetual|pnl de cierre/i.test(text)) return 'binance'
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
  const explicit = text.match(/\b(long|short|largo|corto)\b|лонг|шорт/i)
  if (explicit) {
    const word = explicit[0].toLowerCase()
    return { value: word === 'long' || word === 'лонг' || word === 'largo' ? 'long' : 'short', confidence: 'high' }
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
  // "Compra", "Cerrar venta"
  const spanish = text.match(/(cerra\p{L}*[ \t]*\(?)?(?<!\p{L})(compra|comprar|venta|vender)(?!\p{L})/iu)
  if (spanish) {
    const closing = Boolean(spanish[1])
    const buy = /^compra/i.test(spanish[2]!)
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

/**
 * A date and time on a line, as a `datetime-local` value: "2026-10-27 12:40:11", Russian
 * "27.10.2026, 12:40:11" or Spanish "27/10/2026 12:40:11" (day first). Without a year
 * ("26.10, 12:44") it isn't trusted.
 */
export function dateTimeIn(line: string): string | undefined {
  const pad = (value: string) => value.padStart(2, '0')
  const iso = line.match(/(\d{4})-(\d{1,2})-(\d{1,2})[ T,]+(\d{1,2}):(\d{2})/)
  // Day first with dots (Russian) or slashes (Spanish): "27.10.2026, 12:40", "27/10/2026 12:40".
  const dotted = line.match(/(\d{1,2})[./](\d{1,2})[./](\d{4}),?\s+(\d{1,2}):(\d{2})/)
  const [year, month, day, hour, minute] = iso ? iso.slice(1) : dotted ? [dotted[3], dotted[2], dotted[1], dotted[4], dotted[5]] : []
  if (!year || !month || !day || !hour || !minute) return undefined
  if (Number(month) > 12 || Number(day) > 31 || Number(hour) > 23 || Number(minute) > 59) return undefined
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${minute}`
}

/**
 * The size behind an order's value: the shortest quantity that, times the fill price, gives the
 * printed value to its last digit ("14 341,06" at 1 229,93673242 is 11.66).
 */
export function quantityFromValue(value: string, price: string): string | undefined {
  const fill = new Big(price)
  if (fill.lte(0)) return undefined
  const decimals = value.includes('.') ? value.length - value.indexOf('.') - 1 : 0
  const tolerance = new Big(10).pow(-decimals).div(2)
  for (let places = 0; places <= 8; places++) {
    const quantity = new Big(value).div(fill).round(places)
    if (quantity.gt(0) && quantity.times(fill).minus(value).abs().lte(tolerance)) return quantity.toString()
  }
  return undefined
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

  const filled: Partial<Record<'open' | 'close', PrintedNumber>> = {}
  const orderFees: string[] = []
  let section: 'open' | 'close' | undefined

  lines.forEach((line, index) => {
    const next = lines[index + 1]
    const header = line.match(ORDER_SECTION)
    if (header) section = header[1] ? 'open' : 'close'
    const valueHere = (pattern: RegExp) => {
      const match = line.match(pattern)
      if (!match) return undefined
      const after = line.slice((match.index ?? 0) + match[0].length)
      return numbersIn(after, russian).find(isAmount) ?? (next && labelsIn(next).length === 0 ? numbersIn(next, russian).find(isAmount) : undefined)
    }

    // Order history: the fill price and value belong to the order above them.
    if (section && FILL_PRICE.test(line)) {
      const price = valueHere(FILL_PRICE)
      if (price) assign(section === 'open' ? 'entryPrice' : 'exitPrice', price, base)
      return
    }
    if (section && FILLED_VALUE.test(line)) {
      const value = valueHere(FILLED_VALUE)
      if (value && !filled[section]) filled[section] = value
      return
    }

    if (!FUNDING.test(line)) {
      const total = TOTAL_FEE.test(line) ? valueHere(TOTAL_FEE) : undefined
      if (total && !result.fees) result.fees = { value: new Big(total.value).toString(), confidence: base }
      else if (!total && ORDER_FEE.test(line) && labelsIn(line).length === 0) {
        const fee = valueHere(ORDER_FEE)
        if (fee) orderFees.push(fee.value)
      }
    }
    for (const [field, pattern] of [['openedAt', OPENED_AT], ['closedAt', CLOSED_AT]] as const) {
      if (result[field] || !pattern.test(line)) continue
      // The time below the label counts only when the label stands alone: "Closed Vol." is a size,
      // and a next line with its own label ("Opened …") holds that label's time.
      const alone = labelsIn(line).length === 0 && next !== undefined && !OPENED_AT.test(next) && !CLOSED_AT.test(next)
      const at = dateTimeIn(line.slice(line.search(pattern))) ?? (alone ? dateTimeIn(next) : undefined)
      if (at) result[field] = { value: at, confidence: base }
    }

    const labels = labelsIn(line)
    if (labels.length === 0) return
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

  repairFillPrices(result, filled)

  // Order history: the size is an order's value over its fill price. Both orders give it. The one
  // the printed PnL agrees with wins (OCR can drop the marks from a value: "412111" for
  // "4,121.11"); otherwise the one with fewer decimals, as a digit dropped from a price adds some.
  if (!result.quantity) {
    const sizes = [
      filled.open && result.entryPrice ? quantityFromValue(filled.open.value, result.entryPrice.value) : undefined,
      filled.close && result.exitPrice ? quantityFromValue(filled.close.value, result.exitPrice.value) : undefined,
    ].filter((size): size is string => size !== undefined)
    const decimals = (size: string) => (size.includes('.') ? size.length - size.indexOf('.') : 0)
    const pnlGap = (size: string) => {
      const { pnl, entryPrice, exitPrice, fees } = result
      if (!pnl || !entryPrice || !exitPrice || new Big(pnl.value).eq(0)) return Infinity
      const gross = new Big(exitPrice.value).minus(entryPrice.value).abs().times(size)
      const printed = new Big(pnl.value).abs()
      const fee = new Big(fees?.value ?? 0)
      return Math.min(...[gross, gross.plus(fee), gross.minus(fee)].map((amount) => amount.minus(printed).abs().div(printed).toNumber()))
    }
    const agreeing = sizes.filter((size) => pnlGap(size) < 0.03)
    const quantity = (agreeing.length === 1 ? agreeing : sizes).sort((a, b) => decimals(a) - decimals(b))[0]
    if (quantity) {
      result.quantity = { value: quantity, confidence: 'low' }
      result.quantityUnit = 'base'
    }
  }
  fixPricesFromSize(result, filled)
  if (!result.fees && orderFees.length > 0) {
    result.fees = { value: orderFees.reduce((sum, fee) => sum.plus(fee), new Big(0)).toString(), confidence: 'low' }
  }
  if (result.openedAt && result.closedAt && result.closedAt.value < result.openedAt.value) {
    delete result.openedAt
    delete result.closedAt
  }

  // Share cards (OKX, Binance) print the PnL as a bare amount under the ROI, with no label.
  if (!result.pnl) {
    const bare = lines.find((line) => labelsIn(line).length === 0 && /^[+\-−–]?\d[\d\s.,]*\s?[A-Z]{3,5}$/.test(line))
    const amount = bare ? numbersIn(bare, russian).find((item) => QUOTES.includes(item.unit)) : undefined
    if (amount) result.pnl = { value: amount.value, confidence: 'low' }
  }

  const roi = findRoi(lines)
  const checked = deriveQuantity(crossCheck(checkRoi(alignPrices(result), roi)))
  return roi ? { ...checked, roi } : checked
}

/** The ROI a share card prints in large type, "+293.42%": a signed percentage. */
function findRoi(lines: readonly string[]): string | undefined {
  for (const line of lines) {
    // OCR reads a 7 next to the percent sign as a slash ("-16.8/%") and may lose the decimal
    // point to a gap ("+293  42%").
    const match = line.replace(/(?<=\d)\/(?=\d|%)/g, '7').match(/(?<![\d.,])([+\-−–])\s?(\d{1,5})(?:(?:[.,]|\s{1,3})(\d{1,2}))?\s?%/)
    if (match) return `${/[+]/.test(match[1]!) ? '' : '-'}${match[2]}${match[3] ? `.${match[3]}` : ''}`
  }
  return undefined
}

/**
 * Share cards (BingX, Binance, Bybit) print the ROI and the leverage but no size: the ROI is the
 * price move times the leverage, so one price follows from the other. A missing price is filled
 * in; a price whose digits are the start of the computed one lost its last digits to OCR (busy
 * card art: "0.0977" for "0.09778") and is completed. Prices that disagree otherwise are kept,
 * as the ROI may include fees.
 */
/** How far the ROI implied by the prices is from the printed one, in percentage points. */
function roiGap(roi: string, side: Side, leverage: string, entry: string, exit: string): number {
  if (Number(entry) <= 0) return Infinity
  const implied = new Big(exit).div(entry).minus(1).times(side === 'long' ? 1 : -1).times(leverage).times(100)
  return implied.minus(roi).abs().toNumber()
}

const roiAgrees = (roi: string, gap: number) => gap <= Math.abs(Number(roi)) * 0.002 + 0.05

function checkRoi(result: ParsedScreenshot, roi: string | undefined): ParsedScreenshot {
  const { side, leverage, entryPrice, exitPrice } = result
  if (!roi || !side || !leverage || (!entryPrice && !exitPrice)) return result
  const factor = new Big(1).plus(new Big(roi).div(100).div(leverage.value).times(side.value === 'long' ? 1 : -1))
  if (factor.lte(0)) return result
  const decimals = (number: string) => (number.includes('.') ? number.length - number.indexOf('.') - 1 : 0)
  const digits = (number: string) => number.replace('.', '').replace(/^0+/, '')
  const completes = (printed: string, computed: string) => digits(computed).length > digits(printed).length && digits(computed).startsWith(digits(printed))
  if (entryPrice && exitPrice) {
    if (roiAgrees(roi, roiGap(roi, side.value, leverage.value, entryPrice.value, exitPrice.value))) return result
    const entry = new Big(exitPrice.value).div(factor).toFixed(decimals(exitPrice.value))
    if (completes(entryPrice.value, entry)) return { ...result, entryPrice: { value: entry, confidence: 'low' } }
    const exit = new Big(entryPrice.value).times(factor).toFixed(decimals(entryPrice.value))
    if (completes(exitPrice.value, exit)) return { ...result, exitPrice: { value: exit, confidence: 'low' } }
    return result
  }
  if (exitPrice) return { ...result, entryPrice: { value: new Big(exitPrice.value).div(factor).toFixed(decimals(exitPrice.value)), confidence: 'low' } }
  return { ...result, exitPrice: { value: new Big(entryPrice!.value).times(factor).toFixed(decimals(entryPrice!.value)), confidence: 'low' } }
}

const RECOGNIZED_FIELDS = ['symbol', 'side', 'entryPrice', 'exitPrice', 'quantity', 'leverage', 'pnl', 'fees', 'openedAt', 'closedAt'] as const

/** How many fields a reading found; the reading with more is the better one. */
export function recognizedCount(parsed: ParsedScreenshot): number {
  return RECOGNIZED_FIELDS.filter((field) => parsed[field] !== undefined).length
}

/**
 * Joins two readings of one screenshot (the plain one and one with the card art masked out):
 * the reading that found more is kept, and the other only fills its gaps.
 */
export function mergeReadings(first: ParsedScreenshot, second: ParsedScreenshot): ParsedScreenshot {
  const [main, extra] = recognizedCount(second) > recognizedCount(first) ? [second, first] : [first, second]
  const merged: ParsedScreenshot = { ...main }
  for (const field of RECOGNIZED_FIELDS) if (!merged[field] && extra[field]) Object.assign(merged, { [field]: extra[field] })
  merged.exchange ??= extra.exchange
  merged.roi ??= extra.roi
  if (!main.quantity && extra.quantity) merged.quantityUnit = extra.quantityUnit
  // The readings may disagree on a digit of a price ("0.09788" and "0.09778"): with the ROI known,
  // the entry and exit that agree with it win.
  const { roi, side, leverage } = merged
  if (roi && side && leverage) {
    const entries = [main.entryPrice, extra.entryPrice].filter((price) => price !== undefined)
    const exits = [main.exitPrice, extra.exitPrice].filter((price) => price !== undefined)
    let best: { entry: Recognized<string>; exit: Recognized<string>; gap: number } | undefined
    for (const entry of entries) {
      for (const exit of exits) {
        const gap = roiGap(roi, side.value, leverage.value, entry.value, exit.value)
        if (roiAgrees(roi, gap) && (!best || gap < best.gap)) best = { entry, exit, gap }
      }
    }
    if (best) Object.assign(merged, { entryPrice: best.entry, exitPrice: best.exit })
  }
  return merged
}

/**
 * Some apps print fill prices after a currency sign ("₮0,5489") that OCR reads as a digit
 * ("10,5489"). Opening and closing orders of one trade hold the same size, so each order's value
 * over its price must agree: of the prices with and without a suspect first digit, the pair
 * that agrees best wins.
 */
function repairFillPrices(result: ParsedScreenshot, filled: Partial<Record<'open' | 'close', PrintedNumber>>): void {
  const { entryPrice, exitPrice } = result
  if (!entryPrice || !exitPrice || !filled.open || !filled.close) return
  const options = (price: string) => (/^[17]\d/.test(price) ? [price, price.slice(1)] : [price])
  const gap = (entry: string, exit: string) => {
    if (Number(entry) <= 0 || Number(exit) <= 0) return Infinity
    const open = new Big(filled.open!.value).div(entry)
    const close = new Big(filled.close!.value).div(exit)
    return open.minus(close).abs().div(open).toNumber()
  }
  let best = { entry: entryPrice.value, exit: exitPrice.value, gap: gap(entryPrice.value, exitPrice.value) }
  if (best.gap < 0.0005) return
  for (const entry of options(entryPrice.value)) {
    for (const exit of options(exitPrice.value)) {
      const candidate = gap(entry, exit)
      if (candidate < best.gap) best = { entry, exit, gap: candidate }
    }
  }
  if (best.gap >= 0.0005) return
  if (best.entry !== entryPrice.value) result.entryPrice = { value: best.entry, confidence: 'low' }
  if (best.exit !== exitPrice.value) result.exitPrice = { value: best.exit, confidence: 'low' }
}

/**
 * With the size known, an order's value pins its fill price: a price that doesn't give the
 * printed value to its last digit lost one to OCR ("0,551" for "0,5511"). It is recomputed to
 * the other price's decimals, when that lands near the other price and gives the value exactly.
 */
function fixPricesFromSize(result: ParsedScreenshot, filled: Partial<Record<'open' | 'close', PrintedNumber>>): void {
  const size = result.quantity?.value
  if (!size || Number(size) <= 0) return
  const decimals = (number: string) => (number.includes('.') ? number.length - number.indexOf('.') - 1 : 0)
  const pairs = [
    ['entryPrice', filled.open, result.exitPrice],
    ['exitPrice', filled.close, result.entryPrice],
  ] as const
  for (const [field, value, other] of pairs) {
    const price = result[field]
    if (!price || !value || !other) continue
    const tolerance = new Big(10).pow(-decimals(value.value)).div(2)
    const gives = (candidate: Big) => candidate.times(size).minus(value.value).abs().lte(tolerance)
    if (gives(new Big(price.value))) continue
    const fixed = new Big(value.value).div(size).round(Math.max(decimals(other.value), decimals(price.value)))
    const ratio = fixed.div(other.value).toNumber()
    if (gives(fixed) && ratio > 0.8 && ratio < 1.25) result[field] = { value: fixed.toString(), confidence: 'low' }
  }
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
  // The printed PnL may be before fees or after them ("Realized PnL" net of the trading fee).
  const printed = new Big(pnl.value)
  const near = (amount: Big) => amount.abs().minus(printed).abs().lte(amount.abs().times(0.03))
  if (!near(computed) && !(result.fees && near(computed.minus(result.fees.value)))) return result
  const confirm = <T,>(field: Recognized<T>): Recognized<T> => ({ ...field, confidence: 'high' })
  return { ...result, side: confirm(side), entryPrice: confirm(entryPrice), exitPrice: confirm(exitPrice), quantity: confirm(quantity) }
}
