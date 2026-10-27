import type Big from 'big.js'
import type { Currency } from '../core/models'
import type { Locale } from './i18n'

// Display formatting (SPEC section 6, rounding): money with 2 decimals, prices as typed,
// R with 1 decimal. Values reach Intl as decimal strings, so no float rounding sneaks in.

/** USDT isn't an ISO 4217 code; it's pegged to the dollar, so it's shown as USD. */
function isoCurrency(_currency: Currency): string {
  return 'USD'
}

/** Money with a sign on non-zero amounts, so profit and loss never rely on color alone. */
export function formatMoney(amount: Big, currency: Currency, locale: Locale, signed = true): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: isoCurrency(currency),
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(amount.toFixed(2) as `${number}`)
}

export function formatR(r: Big, locale: Locale): string {
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(r.toFixed(1) as `${number}`)
  return `${number}R`
}

export function formatPercent(percent: Big, locale: Locale): string {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(percent.toFixed(2) as `${number}`)}%`
}

/** A price or size exactly as stored, with locale grouping and decimal separator. */
export function formatDecimal(value: string, locale: Locale): string {
  const [, fraction = ''] = value.split('.')
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fraction.length,
    maximumFractionDigits: Math.min(fraction.length, 20),
  }).format(value as `${number}`)
}

export function formatDay(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(iso))
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
    .map(([value, unit]) => new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short' }).format(value))
    .join(' ')
}
