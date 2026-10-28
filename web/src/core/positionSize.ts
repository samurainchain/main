import Big from 'big.js'
import { parsePositive } from './decimal'
import type { AssetClass, Side } from './models'

// Position size calculator (SPEC section 4.4): how big a position to take so that being
// stopped out loses a chosen share of the account, or a chosen amount. Pure; money is Decimal.

export type RiskMode = 'percent' | 'amount'

export interface SizeInput {
  market: AssetClass
  /** Account balance, in the account currency. */
  balance: string
  riskMode: RiskMode
  /** Percent of the balance, or an amount of money. */
  risk: string
  entry: string
  stop: string
  /** Value of one point for futures; "1" elsewhere. */
  multiplier: string
  /** Optional target, for reward-to-risk. */
  takeProfit?: string
  /** Crypto perpetuals: margin needed is the position value divided by leverage. */
  leverage?: string
}

export type SizeError = 'balance' | 'risk' | 'riskTooHigh' | 'entry' | 'stop' | 'stopAtEntry' | 'multiplier' | 'takeProfit' | 'takeProfitSide' | 'tooSmall'

export interface SizeResult {
  /** Long when the stop is below the entry, short when above. */
  side: Side
  /** Money the trader chose to risk. */
  budget: Big
  /** Price distance from entry to stop, and as a percent of the entry. */
  stopDistance: Big
  stopPercent: Big
  /** Coins, shares or contracts, rounded down to what can be traded. */
  quantity: Big
  /** Loss at the stop with the rounded quantity; never above the budget. */
  risk: Big
  /** Risk as a percent of the balance. */
  riskPercent: Big
  /** Position value at entry. */
  notional: Big
  margin?: Big
  reward?: Big
  rewardRisk?: Big
}

/** Crypto sizes go to 6 decimals; shares and contracts are whole. */
export const CRYPTO_SIZE_DECIMALS = 6

function sizeDecimals(market: AssetClass): number {
  return market === 'cryptoSpot' || market === 'cryptoPerp' ? CRYPTO_SIZE_DECIMALS : 0
}

export function positionSize(input: SizeInput): { result: SizeResult } | { error: SizeError } {
  const balance = parsePositive(input.balance)
  if (!balance) return { error: 'balance' }
  const riskValue = parsePositive(input.risk)
  if (!riskValue) return { error: 'risk' }
  const entry = parsePositive(input.entry)
  if (!entry) return { error: 'entry' }
  const stop = parsePositive(input.stop)
  if (!stop) return { error: 'stop' }
  const multiplier = parsePositive(input.multiplier)
  if (!multiplier) return { error: 'multiplier' }

  const budget = input.riskMode === 'percent' ? new Big(balance).times(riskValue).div(100) : new Big(riskValue)
  if (budget.gt(balance)) return { error: 'riskTooHigh' }
  const stopDistance = new Big(entry).minus(stop).abs()
  if (stopDistance.eq(0)) return { error: 'stopAtEntry' }
  const side: Side = new Big(stop).lt(entry) ? 'long' : 'short'

  const riskPerUnit = stopDistance.times(multiplier)
  const quantity = budget.div(riskPerUnit).round(sizeDecimals(input.market), Big.roundDown)
  if (quantity.eq(0)) return { error: 'tooSmall' }
  const risk = quantity.times(riskPerUnit)
  const notional = quantity.times(entry).times(multiplier)
  const leverage = input.market === 'cryptoPerp' && input.leverage ? parsePositive(input.leverage) : undefined

  let reward: Big | undefined
  if (input.takeProfit?.trim()) {
    const target = parsePositive(input.takeProfit)
    if (!target) return { error: 'takeProfit' }
    const gain = new Big(target).minus(entry).times(side === 'long' ? 1 : -1)
    if (gain.lte(0)) return { error: 'takeProfitSide' }
    reward = gain.times(quantity).times(multiplier)
  }

  return {
    result: {
      side,
      budget,
      stopDistance,
      stopPercent: stopDistance.div(entry).times(100),
      quantity,
      risk,
      riskPercent: risk.div(balance).times(100),
      notional,
      margin: leverage ? notional.div(leverage) : undefined,
      reward,
      rewardRisk: reward ? reward.div(risk) : undefined,
    },
  }
}
