import Big from 'big.js'
import { describe, expect, it } from 'vitest'
import { formatDateTime, formatMoney, formatMoneyCompact, formatShare } from './format'

describe('formatMoney', () => {
  it('writes dollars with a sign in every language', () => {
    expect(formatMoney(new Big('-1475'), 'USD', 'en')).toBe('-$1,475.00')
    expect(formatMoney(new Big('885'), 'USDT', 'en')).toBe('+$885.00')
    expect(formatMoney(new Big('0'), 'USD', 'en')).toBe('$0.00')
  })

  it('formats Spanish the Mexican way, not Spain’s "-1475,00 US$"', () => {
    expect(formatMoney(new Big('-1475'), 'USD', 'es')).toBe('-$1,475.00')
    expect(formatMoney(new Big('332.5'), 'USD', 'es')).toBe('+$332.50')
    // Browsers say "+$1.2 k"; Node's ICU puts the symbol last. Either way: a point, no "US".
    expect(formatMoneyCompact(new Big('1200'), 'USD', 'es')).toMatch(/^\+\$?1\.2\s?k\$?$/i)
    expect(formatShare(new Big('0.52'), 'es')).toBe('52%')
    expect(formatDateTime(new Date(2026, 9, 29, 14, 5).toISOString(), 'es').replace(/\s/g, ' ')).toBe('29 oct 2026, 2:05 p.m.')
  })

  it('keeps the Russian grouping', () => {
    expect(formatMoney(new Big('-1475'), 'USD', 'ru').replace(/\s/g, ' ')).toBe('-1 475,00 $')
  })
})
