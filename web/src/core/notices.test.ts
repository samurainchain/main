import Big from 'big.js'
import { describe, expect, it } from 'vitest'
import type { AutoFlag } from './mistakeDetector'
import { defaultProfile, type Trade } from './models'
import { markSeen, notices, unseenCount, type NoticeInput } from './notices'

// Wednesday, Oct 28, 2026, 15:00 local.
const NOW = new Date(2026, 9, 28, 15)
let sequence = 0
function trade(pnl: string, hour: number, overrides: Partial<Trade> = {}): Trade {
  sequence += 1
  const at = new Date(2026, 9, 28, hour).toISOString()
  return {
    id: `t${sequence}`, accountId: 'a', symbol: 'BTCUSDT', side: 'long', market: 'cryptoPerp', entryPrice: '100',
    exitPrice: new Big(100).plus(pnl).toString(), quantity: '1', contractMultiplier: '1', fees: '0', openedAt: at, closedAt: at,
    mistakeIds: [], setupIds: [], brokenRuleIds: [], note: '', source: 'manual', createdAt: at, updatedAt: at, ...overrides,
  }
}
const base: NoticeInput = { trades: [], profile: defaultProfile(), reviews: [], checkins: [], autoFlags: new Map(), now: NOW, weekStart: 1 }
const kinds = (input: Partial<NoticeInput>) => notices({ ...base, ...input }).map((notice) => notice.kind)

describe('notices', () => {
  it('asks for the day check-in until it is done', () => {
    expect(kinds({})).toEqual(['checkIn'])
    expect(kinds({ checkins: [{ id: 'day-2026-10-28', date: '2026-10-28' } as never] })).toEqual([])
  })

  it('warns near a daily limit and says when it is reached', () => {
    const profile = { ...defaultProfile(), dailyTradeLimit: 5 }
    const four = [1, 2, 3, 4].map((hour) => trade('1', hour + 8))
    expect(kinds({ profile, trades: four })).toEqual(['limitWarning', 'checkIn'])
    expect(kinds({ profile, trades: [...four, trade('1', 13)] })).toEqual(['limitReached', 'checkIn'])
  })

  it('counts today’s revenge flags the trader hasn’t dismissed', () => {
    const flagged = trade('-5', 10)
    const dismissed = trade('-5', 11, { dismissedFlags: ['revengeTrading'] })
    const flag: AutoFlag[] = [{ key: 'revengeTrading', minutes: 3 } as AutoFlag]
    const list = notices({ ...base, trades: [flagged, dismissed], autoFlags: new Map([[flagged.id, flag], [dismissed.id, flag]]) })
    expect(list[0]).toMatchObject({ kind: 'revenge', count: 1 })
  })

  it('reminds about the weekly review on its day until it is written', () => {
    const profile = { ...defaultProfile(), reviewWeekday: 3 }
    const list = notices({ ...base, profile })
    expect(list.map((notice) => notice.kind)).toEqual(['reviewDue', 'checkIn'])
    const week = list[0]!.id.replace('reviewDue-', '')
    expect(kinds({ profile, reviews: [{ weekStart: week } as never] })).toEqual(['checkIn'])
  })

  it('tracks which notices were seen', () => {
    const list = notices(base)
    expect(unseenCount([], list)).toBe(1)
    expect(unseenCount(markSeen(list), list)).toBe(0)
    expect(unseenCount(markSeen(list), notices({ ...base, now: new Date(2026, 9, 29, 9) }))).toBe(1)
  })
})
