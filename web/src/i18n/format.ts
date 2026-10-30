import type Big from 'big.js'
import type { Currency } from '../core/models'
import type { Locale } from './i18n'

// Display formatting (SPEC section 6, rounding): money with 2 decimals, prices as typed,
// R with 1 decimal. Values reach Intl as decimal strings, so no float rounding sneaks in.

/**
 * The region behind each app language. Spanish is formatted for Mexico, where most Spanish-speaking
 * users are: "-$1,475.00" and "2:05 p.m." rather than Spain's "-1475,00 US$".
 */
export function intlLocale(locale: Locale): string {
  return locale === 'es' ? 'es-MX' : locale
}

/** USDT isn't an ISO 4217 code; it's pegged to the dollar, so it's shown as USD. */
function isoCurrency(_currency: Currency): string {
  return 'USD'
}

/** Money with a sign on non-zero amounts, so profit and loss never rely on color alone. */
export function formatMoney(amount: Big, currency: Currency, locale: Locale, signed = true): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: isoCurrency(currency),
    currencyDisplay: 'narrowSymbol',
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(amount.toFixed(2) as `${number}`)
}

/** A price from the payment provider, in the smallest unit (cents), e.g. 4499 → "$44.99". */
export function formatPrice(minorUnits: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency: currency.toUpperCase() }).format(minorUnits / 100)
}

export function formatR(r: Big, locale: Locale): string {
  const number = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(r.toFixed(1) as `${number}`)
  return `${number}R`
}

export function formatPercent(percent: Big, locale: Locale): string {
  return `${new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(percent.toFixed(2) as `${number}`)}%`
}

/** A price or size exactly as stored, with locale grouping and decimal separator. */
export function formatDecimal(value: string, locale: Locale): string {
  const [, fraction = ''] = value.split('.')
  return new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: fraction.length,
    maximumFractionDigits: Math.min(fraction.length, 20),
  }).format(value as `${number}`)
}

/** "Nov 3, 2026". */
export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'medium' }).format(date)
}

export function formatDay(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeStyle: 'short' }).format(new Date(iso))
}

/** "2 h 15 min" style duration from milliseconds. */
export function formatDuration(ms: number, locale: Locale): string {
  const minutes = Math.round(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  const parts: [number, 'day' | 'hour' | 'minute'][] =
    days > 0 ? [[days, 'day'], [hours, 'hour']] : hours > 0 ? [[hours, 'hour'], [mins, 'minute']] : [[mins, 'minute']]
  return parts
    .filter(([value], index) => index === 0 || value > 0)
    .map(([value, unit]) => new Intl.NumberFormat(intlLocale(locale), { style: 'unit', unit, unitDisplay: 'short' }).format(value))
    .join(' ')
}

/** A 0–1 ratio as a whole percentage, e.g. win rate. */
export function formatShare(ratio: Big, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: 'percent', maximumFractionDigits: 0 }).format(ratio.toFixed(4) as `${number}`)
}

/** A plain ratio with 2 decimals, e.g. profit factor. */
export function formatRatio(value: Big, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value.toFixed(2) as `${number}`)
}

/** Compact money for chart labels: "+$1.2K". */
export function formatMoneyCompact(amount: Big, currency: Currency, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: isoCurrency(currency),
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(amount.toFixed(2) as `${number}`)
}

export function formatMonth(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric' }).format(date)
}

/** Short weekday names indexed like `Date.getDay()` (0 = Sunday). */
export function weekdayNames(locale: Locale, width: 'long' | 'short' | 'narrow' = 'short'): string[] {
  const sunday = new Date(2026, 0, 4)
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(intlLocale(locale), { weekday: width }).format(new Date(sunday.getFullYear(), 0, 4 + index)),
  )
}

/** "Oct 26 – Nov 1" for a week starting at `start`. */
export function formatWeekRange(start: Date, locale: Locale): string {
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  return new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short' }).formatRange(start, end)
}
