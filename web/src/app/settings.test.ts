import { describe, expect, it } from 'vitest'
import { clampRailWidth, RAIL_DEFAULT_WIDTH, RAIL_MAX_WIDTH, RAIL_MIN_WIDTH } from './settings'

describe('clampRailWidth', () => {
  it('keeps the right column within its range', () => {
    expect(clampRailWidth(100)).toBe(RAIL_MIN_WIDTH)
    expect(clampRailWidth(2000)).toBe(RAIL_MAX_WIDTH)
    expect(clampRailWidth(401.6)).toBe(402)
  })

  it('falls back to the default for a broken saved value', () => {
    expect(clampRailWidth(Number.NaN)).toBe(RAIL_DEFAULT_WIDTH)
  })
})
