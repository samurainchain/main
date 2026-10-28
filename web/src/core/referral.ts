import Big from 'big.js'

// Partner program (SPEC section 8): the terms the app shows, and the pure rules for reading a
// referral link and keeping it until sign-up. Commissions themselves are worked out in the
// database (apply_crypto_order in supabase/schema.sql); keep the numbers in step.

export const PARTNER_TERMS = {
  /** Share of each Pro payment, as a fraction. */
  rate: '0.30',
  /** Commissions run this long from the referred trader's first payment. */
  months: 12,
  /** How long a link waits in the browser for the visitor to sign up. */
  windowDays: 60,
  /** Days after a payment before its commission can be paid out. */
  holdDays: 14,
  /** Smallest payout, in USD paid as USDT. */
  minPayout: 30,
} as const

const CODE = /^[a-z0-9]{6,16}$/
const DAY = 86_400_000

/** The `ref` code in a URL's query, before or after the hash route; undefined when absent or malformed. */
export function referralCodeFrom(url: string): string | undefined {
  const parsed = new URL(url)
  const hashQuery = parsed.hash.includes('?') ? parsed.hash.slice(parsed.hash.indexOf('?')) : ''
  const raw = parsed.searchParams.get('ref') ?? new URLSearchParams(hashQuery).get('ref')
  const code = raw?.trim().toLowerCase()
  return code && CODE.test(code) ? code : undefined
}

/** The same URL without its `ref` parameter, so a shared address doesn't carry someone's code. */
export function withoutReferral(url: string): string {
  const parsed = new URL(url)
  parsed.searchParams.delete('ref')
  if (parsed.hash.includes('?')) {
    const [route, query] = [parsed.hash.slice(0, parsed.hash.indexOf('?')), new URLSearchParams(parsed.hash.slice(parsed.hash.indexOf('?')))]
    query.delete('ref')
    parsed.hash = query.size ? `${route}?${query.toString()}` : route
  }
  return parsed.toString()
}

export interface StoredReferral {
  code: string
  /** When the link was opened, ms since epoch. */
  at: number
}

export function isFresh(stored: StoredReferral | undefined, now: number): stored is StoredReferral {
  return stored !== undefined && now - stored.at <= PARTNER_TERMS.windowDays * DAY && now >= stored.at
}

/**
 * Which link to keep: the first one opened wins while it is still fresh (so a later link can't
 * take a visitor someone else brought), and a new one replaces an expired one.
 */
export function keepReferral(stored: StoredReferral | undefined, code: string, now: number): StoredReferral {
  return isFresh(stored, now) ? stored : { code, at: now }
}

/** A partner's share of a payment, rounded to cents the way the database does. */
export function commissionFor(paymentUsd: string): Big {
  return new Big(paymentUsd).times(PARTNER_TERMS.rate).round(2, Big.roundHalfUp)
}

/** A TRON (TRC20) address: T followed by 33 base58 characters. */
export function isTronAddress(value: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value.trim())
}
