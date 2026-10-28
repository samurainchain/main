import { describe, expect, it } from 'vitest'
import { positionSize, type SizeInput } from './positionSize'

const base: SizeInput = { market: 'cryptoPerp', balance: '10000', riskMode: 'percent', risk: '1', entry: '67000', stop: '66000', multiplier: '1' }

function size(patch: Partial<SizeInput>) {
  const outcome = positionSize({ ...base, ...patch })
  if ('error' in outcome) throw new Error(outcome.error)
  return outcome.result
}

describe('positionSize', () => {
  it('sizes a crypto long so the stop loses 1% of the balance', () => {
    const result = size({ leverage: '10', takeProfit: '70000' })
    expect(result.side).toBe('long')
    expect(result.budget.toString()).toBe('100')
    expect(result.quantity.toString()).toBe('0.1')
    expect(result.risk.toString()).toBe('100')
    expect(result.notional.toString()).toBe('6700')
    expect(result.margin?.toString()).toBe('670')
    expect(result.stopPercent.toFixed(2)).toBe('1.49')
    expect(result.rewardRisk?.toString()).toBe('3')
  })

  it('rounds crypto down to 6 decimals and never risks more than the budget', () => {
    const result = size({ entry: '3', stop: '2.7', risk: '0.37' })
    expect(result.quantity.toString()).toBe('123.333333')
    expect(result.risk.lte(37)).toBe(true)
  })

  it('takes a fixed amount and reads a short from a stop above the entry', () => {
    const result = size({ market: 'stock', riskMode: 'amount', risk: '250', entry: '187.25', stop: '190' })
    expect(result.side).toBe('short')
    expect(result.quantity.toString()).toBe('90')
    expect(result.risk.toString()).toBe('247.5')
    expect(result.riskPercent.toString()).toBe('2.475')
  })

  it('uses the contract multiplier for futures and whole contracts', () => {
    const result = size({ market: 'futures', balance: '50000', risk: '0.5', entry: '5000', stop: '4990', multiplier: '5' })
    expect(result.quantity.toString()).toBe('5')
    expect(result.risk.toString()).toBe('250')
    expect(result.notional.toString()).toBe('125000')
    expect(result.margin).toBeUndefined()
  })

  it('accepts comma decimals', () => {
    expect(size({ entry: '1,1455', stop: '1,1405', market: 'cryptoSpot', riskMode: 'amount', risk: '50' }).quantity.toString()).toBe('10000')
  })

  it.each([
    [{ balance: '' }, 'balance'],
    [{ risk: '0' }, 'risk'],
    [{ riskMode: 'amount', risk: '20000' }, 'riskTooHigh'],
    [{ entry: 'abc' }, 'entry'],
    [{ stop: '67000' }, 'stopAtEntry'],
    [{ market: 'futures', multiplier: '50', entry: '5000', stop: '4000', risk: '0.1' }, 'tooSmall'],
    [{ takeProfit: '65000' }, 'takeProfitSide'],
    [{ takeProfit: 'x' }, 'takeProfit'],
  ] as const)('reports %o as %s', (patch, error) => {
    expect(positionSize({ ...base, ...(patch as Partial<SizeInput>) })).toEqual({ error })
  })
})
