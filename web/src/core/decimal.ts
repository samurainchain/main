import Big from 'big.js'
import type { DecimalString } from './models'

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/

/**
 * Parses what the user typed into a decimal string, or returns undefined when it isn't a
 * non-negative number. Accepts a comma as the decimal separator and ignores spaces.
 */
export function parseDecimalInput(input: string): DecimalString | undefined {
  const normalized = input.trim().replace(/[\s ']/g, '').replace(',', '.')
  if (!DECIMAL_PATTERN.test(normalized)) return undefined
  return normalized
}

export function toBig(value: DecimalString | undefined): Big | undefined {
  return value === undefined ? undefined : new Big(value)
}

/** A positive decimal string, or undefined for empty, zero or invalid input. */
export function parsePositive(input: string): DecimalString | undefined {
  const parsed = parseDecimalInput(input)
  return parsed !== undefined && new Big(parsed).gt(0) ? parsed : undefined
}
