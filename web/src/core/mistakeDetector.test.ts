import Big from 'big.js'
import { describe, expect, it } from 'vitest'
import { activeFlags, DEFAULT_REVENGE_MINUTES, detectMistakes, effectiveMistakeIds, type AutoFlag, type DetectorSettings } from './mistakeDetector'
import type { Trade } from './models'

let sequence = 0
const DAY = new Date(2026, 9, 27)

/** Local time on the test day, e.g. at(10, 30). */
function at(hour: number, minute = 0, day = DAY): string {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute).toISOString()
}

/** A long trade with entry 100, size 1 and the given PnL, with a stop at 90 unless overridden. */
function trade(pnl: string, overrides: Partial<Trade> = {}): Trade {
  sequence += 1
  return {
    id: `t${sequence}`,
    accountId: 'a',
    symbol: 'BTCUSDT',
    side: 'long',
    market: 'cryptoPerp',
    entryPrice: '100',
    exitPrice: new Big(100).plus(pnl).toString(),
    quantity: '1',
    contractMultiplier: '1',
    initialStopLoss: '90',
    stopLoss: '90',
    fees: '0',
    openedAt: at(10),
    closedAt: at(11),
    mistakeIds: [],
    setupIds: [],
    brokenRuleIds: [],
    note: '',
    source: 'manual',
    createdAt: at(11),
    updatedAt: at(11),
    ...overrides,
  }
}

const SETTINGS: DetectorSettings = { revengeMinutes: DEFAULT_REVENGE_MINUTES }

function flagsOf(target: Trade, trades: Trade[], settings = SETTINGS): AutoFlag[] {
  return detectMistakes(trades, settings).get(target.id) ?? []
}

const keys = (flags: AutoFlag[]) => flags.map((flag) => flag.key)

describe('no stop', () => {
  it('flags a trade without any stop', () => {
    const item = trade('5', { initialStopLoss: undefined, stopLoss: undefined })
    expect(flagsOf(item, [item])).toEqual([{ key: 'noStop' }])
  })

  it('leaves a trade with a stop alone', () => {
    const item = trade('5')
    expect(flagsOf(item, [item])).toEqual([])
  })
})

describe('held past stop', () => {
  it('flags a long whose stop was moved down', () => {
    const item = trade('-5', { initialStopLoss: '95', stopLoss: '90' })
    expect(flagsOf(item, [item])).toEqual([{ key: 'heldPastStop', movedFrom: '95', movedTo: '90' }])
  })

  it('flags a short whose stop was moved up', () => {
    const item = trade('0', { side: 'short', initialStopLoss: '105', stopLoss: '110', exitPrice: '103' })
    expect(keys(flagsOf(item, [item]))).toEqual(['heldPastStop'])
  })

  it('does not flag a stop moved to lock in profit', () => {
    const item = trade('5', { initialStopLoss: '90', stopLoss: '101' })
    expect(flagsOf(item, [item])).toEqual([])
  })

  it('flags a loss worse than -1.1R', () => {
    // Risk 10, loss 12: -1.2R.
    const item = trade('-12')
    expect(flagsOf(item, [item])).toEqual([{ key: 'heldPastStop', r: '-1.2' }])
  })

  it('accepts a full -1R loss with a little slippage', () => {
    const item = trade('-10.5')
    expect(flagsOf(item, [item])).toEqual([])
  })
})

describe('revenge trading', () => {
  const loss = trade('-5', { openedAt: at(9), closedAt: at(10) })

  it('flags a trade opened within the window after a losing exit', () => {
    const next = trade('3', { openedAt: at(10, 6), closedAt: at(10, 30) })
    expect(flagsOf(next, [loss, next])).toEqual([{ key: 'revengeTrading', minutes: 6 }])
  })

  it('leaves trades opened later, or after a win, alone', () => {
    const later = trade('3', { openedAt: at(10, 16), closedAt: at(10, 30) })
    const win = trade('5', { openedAt: at(12), closedAt: at(13) })
    const afterWin = trade('3', { openedAt: at(13, 1), closedAt: at(13, 30) })
    expect(flagsOf(later, [loss, later])).toEqual([])
    expect(flagsOf(afterWin, [win, afterWin])).toEqual([])
  })

  it('uses the configured window', () => {
    const next = trade('3', { openedAt: at(10, 25), closedAt: at(10, 40) })
    expect(keys(flagsOf(next, [loss, next], { revengeMinutes: 30 }))).toEqual(['revengeTrading'])
  })

  it('does not count a trade that was already open when the loss closed', () => {
    const overlapping = trade('3', { openedAt: at(9, 30), closedAt: at(10, 30) })
    expect(flagsOf(overlapping, [loss, overlapping])).toEqual([])
  })
})

describe('overtrading', () => {
  it('flags closed trades past the daily limit, in exit order', () => {
    const day = [1, 2, 3, 4].map((hour) => trade('1', { openedAt: at(hour), closedAt: at(hour, 30) }))
    const flags = detectMistakes(day, { ...SETTINGS, dailyTradeLimit: 2 })
    expect(day.map((item) => flags.get(item.id) ?? [])).toEqual([
      [],
      [],
      [{ key: 'overtrading', position: 3, limit: 2 }],
      [{ key: 'overtrading', position: 4, limit: 2 }],
    ])
  })

  it('is off without a limit', () => {
    const day = [1, 2, 3].map((hour) => trade('1', { openedAt: at(hour), closedAt: at(hour, 30) }))
    expect(detectMistakes(day, SETTINGS).size).toBe(0)
  })
})

describe('high leverage', () => {
  it('flags leverage at least twice the usual', () => {
    const usual = ['10', '10', '10', '5', '20'].map((leverage) => trade('1', { leverage }))
    const high = trade('1', { leverage: '25' })
    expect(flagsOf(high, [...usual, high])).toEqual([{ key: 'highLeverage', leverage: '25', median: '10' }])
    expect(flagsOf(usual[4]!, [...usual, high])).toEqual([{ key: 'highLeverage', leverage: '20', median: '10' }])
  })

  it('waits for five trades with leverage', () => {
    const few = ['5', '5', '50'].map((leverage) => trade('1', { leverage }))
    expect(detectMistakes(few, SETTINGS).size).toBe(0)
  })
})

describe('early exit', () => {
  it('flags profit taken before half the way to the take profit', () => {
    const item = trade('4', { takeProfit: '120' })
    expect(flagsOf(item, [item])).toEqual([{ key: 'earlyExit', percent: 20 }])
  })

  it('works for shorts and leaves exits past halfway alone', () => {
    const short = trade('0', { side: 'short', initialStopLoss: '110', stopLoss: '110', exitPrice: '97', takeProfit: '80' })
    const patient = trade('12', { takeProfit: '120' })
    expect(flagsOf(short, [short])).toEqual([{ key: 'earlyExit', percent: 15 }])
    expect(flagsOf(patient, [patient])).toEqual([])
  })

  it('ignores losing trades and trades without a take profit', () => {
    const loss = trade('-4', { takeProfit: '120' })
    const plain = trade('4')
    expect(detectMistakes([loss, plain], SETTINGS).size).toBe(0)
  })
})

describe('bad hours', () => {
  /** 20 trades a day apart: winners at 10:00, losers at 22:00. */
  function history(): Trade[] {
    return Array.from({ length: 20 }, (_, index) => {
      const day = new Date(2026, 8, index + 1)
      const evening = index % 4 === 0
      return trade(evening ? '-5' : '3', { openedAt: at(evening ? 22 : 10, 0, day), closedAt: at(evening ? 22 : 10, 30, day) })
    })
  }

  it('flags trades opened in an hour that loses on average', () => {
    const trades = history()
    const flags = detectMistakes(trades, SETTINGS)
    const evening = trades.filter((item) => new Date(item.openedAt).getHours() === 22)
    expect(evening).toHaveLength(5)
    for (const item of evening) expect(flags.get(item.id)).toEqual([{ key: 'badHour', hour: 22 }])
    expect(trades.filter((item) => flags.has(item.id))).toHaveLength(5)
  })

  it('waits for 20 closed trades', () => {
    expect(detectMistakes(history().slice(0, 19), SETTINGS).size).toBe(0)
  })
})

describe('dismissed flags and effective mistakes', () => {
  it('drops dismissed flags and merges the rest with the trader’s own tags once', () => {
    const item = trade('-12', { initialStopLoss: undefined, stopLoss: undefined, mistakeIds: ['system-noStop', 'custom'], dismissedFlags: [] })
    const flags: AutoFlag[] = [{ key: 'noStop' }, { key: 'revengeTrading', minutes: 3 }, { key: 'badHour', hour: 22 }]
    expect(effectiveMistakeIds(item, flags)).toEqual(['system-noStop', 'custom', 'system-revengeTrading', 'system-badHour'])
    const dismissed = { ...item, dismissedFlags: ['badHour' as const] }
    expect(keys(activeFlags(dismissed, flags))).toEqual(['noStop', 'revengeTrading'])
    expect(effectiveMistakeIds(dismissed, flags)).toEqual(['system-noStop', 'custom', 'system-revengeTrading'])
  })

  it('keeps a trade without flags as it is', () => {
    const item = trade('1', { mistakeIds: ['custom'] })
    expect(effectiveMistakeIds(item, undefined)).toEqual(['custom'])
  })
})
