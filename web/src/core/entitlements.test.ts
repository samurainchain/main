import { describe, expect, it } from 'vitest'
import { WIDGET_IDS } from './dashboard'
import { canAddAccount, canUse, periodUnlocked, PRO_FEATURES, proActive, widgetUnlocked } from './entitlements'

const open = { gated: false, pro: false }
const free = { gated: true, pro: false }
const pro = { gated: true, pro: true }

describe('entitlements', () => {
  it('opens everything while Pro is not on sale', () => {
    expect(PRO_FEATURES.every((feature) => canUse(feature, open))).toBe(true)
    expect(WIDGET_IDS.every((id) => widgetUnlocked(id, open))).toBe(true)
    expect(canAddAccount(5, open)).toBe(true)
  })

  it('keeps the journal and core analytics free once it is', () => {
    expect(PRO_FEATURES.some((feature) => canUse(feature, free))).toBe(false)
    expect(WIDGET_IDS.filter((id) => widgetUnlocked(id, free))).toEqual(['performance', 'tradeCount', 'streaks', 'equity', 'tradeStats', 'calendar', 'econCalendar'])
    expect(['week', 'month', 'quarter', 'all'].filter((period) => periodUnlocked(period as never, free))).toEqual(['week', 'month'])
    expect([canAddAccount(0, free), canAddAccount(1, free)]).toEqual([true, false])
  })

  it('unlocks everything with Pro', () => {
    expect(PRO_FEATURES.every((feature) => canUse(feature, pro))).toBe(true)
    expect(WIDGET_IDS.every((id) => widgetUnlocked(id, pro))).toBe(true)
    expect(canAddAccount(3, pro)).toBe(true)
  })

  it('counts Pro as running until its end', () => {
    const now = new Date('2026-11-01T12:00:00Z')
    expect(proActive(new Date('2026-11-01T12:00:01Z'), now)).toBe(true)
    expect(proActive(now, now)).toBe(false)
    expect(proActive(undefined, now)).toBe(false)
  })
})
