import { newId, TAG_COLORS, type Account, type AssetClass, type Currency, type SystemMistakeKey } from './models'

// Onboarding (SPEC section 4.1): the answers, and the first accounts they imply.

export const GOALS = ['stopLosing', 'consistency', 'propChallenge', 'tracking'] as const
export type Goal = (typeof GOALS)[number]

export const VENUES = ['binance', 'okx', 'bybit', 'ibkr', 'other'] as const
export type Venue = (typeof VENUES)[number]

export const VENUE_NAMES: Record<Exclude<Venue, 'other'>, string> = {
  binance: 'Binance',
  okx: 'OKX',
  bybit: 'Bybit',
  ibkr: 'Interactive Brokers',
}

/** Weaknesses offered in onboarding, as the system mistake tags they correspond to. */
export const WEAKNESSES = ['fomo', 'revengeTrading', 'heldPastStop', 'highLeverage', 'overtrading', 'earlyExit'] as const satisfies readonly SystemMistakeKey[]
export type Weakness = (typeof WEAKNESSES)[number]

export const TRADE_FREQUENCIES = ['1-5', '6-20', '20+'] as const
export type TradeFrequency = (typeof TRADE_FREQUENCIES)[number]

export interface OnboardingAnswers {
  goal?: Goal
  markets: AssetClass[]
  venues: Venue[]
  weaknesses: Weakness[]
  tradesPerWeek?: TradeFrequency
  currency: Currency
}

/** Translated words for the accounts the app names: the market part and generic venues. */
export interface AccountNames {
  market: Record<AssetClass, string>
  cryptoExchange: string
  broker: string
}

const CRYPTO_VENUES: readonly Venue[] = ['binance', 'okx', 'bybit']

/**
 * The first accounts: one per crypto venue for each crypto market chosen ("Binance — futures"),
 * and one per stock or futures market at the broker ("Interactive Brokers — stocks"). Picked
 * markets without a matching venue get a generic venue ("Crypto exchange — spot").
 * Crypto accounts use the chosen currency; stocks and futures are in USD.
 */
export function accountsFromAnswers(answers: OnboardingAnswers, names: AccountNames, now = new Date()): Account[] {
  const cryptoVenues = answers.venues.filter((venue) => CRYPTO_VENUES.includes(venue))
  const accounts: Omit<Account, 'id' | 'sortOrder' | 'colorHex' | 'createdAt'>[] = []
  const add = (assetClass: AssetClass, venue: string, currency: Currency) =>
    accounts.push({ name: `${venue} — ${names.market[assetClass]}`, assetClass, venue, currency, isArchived: false })

  for (const market of ['cryptoPerp', 'cryptoSpot'] as const) {
    if (!answers.markets.includes(market)) continue
    const venues = cryptoVenues.length > 0 ? cryptoVenues.map((venue) => VENUE_NAMES[venue as Exclude<Venue, 'other'>]) : [names.cryptoExchange]
    for (const venue of venues) add(market, venue, answers.currency)
  }
  const broker = answers.venues.includes('ibkr') ? VENUE_NAMES.ibkr : names.broker
  for (const market of ['stock', 'futures'] as const) {
    if (answers.markets.includes(market)) add(market, broker, 'USD')
  }

  return accounts.map((account, index) => ({
    ...account,
    id: newId(),
    sortOrder: index,
    colorHex: TAG_COLORS[index % TAG_COLORS.length]!,
    createdAt: now.toISOString(),
  }))
}

/** Onboarding needs answers before the first account or trade exists. */
export function canFinish(answers: OnboardingAnswers): boolean {
  return answers.goal !== undefined && answers.markets.length > 0 && answers.tradesPerWeek !== undefined
}
