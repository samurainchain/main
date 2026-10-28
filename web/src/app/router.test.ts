import { describe, expect, it } from 'vitest'
import { parseRoute } from './router'

describe('parseRoute', () => {
  it('reads the screen from the hash', () => {
    expect(parseRoute('#/profile')).toEqual({ name: 'profile' })
    expect(parseRoute('#/trades/t%201')).toEqual({ name: 'trade', id: 't 1' })
    expect(parseRoute('#/review/2026-10-19')).toEqual({ name: 'review', week: '2026-10-19' })
    expect(parseRoute('')).toEqual({ name: 'today' })
  })

  it('ignores a query written after the route', () => {
    expect(parseRoute('#/profile?pro=preview')).toEqual({ name: 'profile' })
    expect(parseRoute('#/trades/t1?x=1')).toEqual({ name: 'trade', id: 't1' })
  })
})
