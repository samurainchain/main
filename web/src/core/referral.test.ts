import { describe, expect, it } from 'vitest'
import { commissionFor, isFresh, isTronAddress, keepReferral, referralCodeFrom, withoutReferral } from './referral'

const DAY = 86_400_000

describe('referral links', () => {
  it('reads the code before or after the hash route, case-insensitively', () => {
    expect(referralCodeFrom('https://tiltless.xyz/?ref=Ab12cd34')).toBe('ab12cd34')
    expect(referralCodeFrom('https://tiltless.xyz/#/today?ref=ab12cd34')).toBe('ab12cd34')
    expect(referralCodeFrom('https://tiltless.xyz/?ref=x')).toBeUndefined()
    expect(referralCodeFrom('https://tiltless.xyz/?ref=<script>')).toBeUndefined()
    expect(referralCodeFrom('https://tiltless.xyz/')).toBeUndefined()
  })

  it('drops the code from the address and keeps everything else', () => {
    expect(withoutReferral('https://tiltless.xyz/?ref=ab12cd34&pro=preview#/today')).toBe('https://tiltless.xyz/?pro=preview#/today')
    expect(withoutReferral('https://tiltless.xyz/#/today?ref=ab12cd34')).toBe('https://tiltless.xyz/#/today')
    expect(withoutReferral('https://tiltless.xyz/#/profile?pro=preview&ref=ab12cd34')).toBe('https://tiltless.xyz/#/profile?pro=preview')
  })

  it('keeps the first link for 60 days, then lets a new one replace it', () => {
    const first = { code: 'first111', at: 0 }
    expect(keepReferral(undefined, 'first111', 0)).toEqual(first)
    expect(keepReferral(first, 'second22', 59 * DAY)).toBe(first)
    expect(keepReferral(first, 'second22', 61 * DAY)).toEqual({ code: 'second22', at: 61 * DAY })
    expect(isFresh(first, 60 * DAY)).toBe(true)
    expect(isFresh(first, 60 * DAY + 1)).toBe(false)
  })
})

describe('commissions and wallets', () => {
  it('pays 30% rounded to cents', () => {
    expect(commissionFor('8.99').toFixed(2)).toBe('2.70')
    expect(commissionFor('44.99').toFixed(2)).toBe('13.50')
  })

  it('accepts only TRON addresses', () => {
    expect(isTronAddress('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE')).toBe(true)
    expect(isTronAddress('0x52908400098527886E0F7030069857D2E4169EE7')).toBe(false)
    expect(isTronAddress('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLS0')).toBe(false)
  })
})
