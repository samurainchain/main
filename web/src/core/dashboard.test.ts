import { describe, expect, it } from 'vitest'
import { defaultLayout, hideWidget, moveWidget, normalizeLayout, resizeWidget, showWidget, snapWidth, stepWidth, WIDGET_IDS } from './dashboard'

const ids = (layout: { items: { id: string }[] }) => layout.items.map((item) => item.id)

describe('dashboard layout', () => {
  it('starts with every block placed or hidden, each once', () => {
    const layout = defaultLayout()
    expect([...ids(layout), ...layout.hidden].sort()).toEqual([...WIDGET_IDS].sort())
  })

  it('repairs a saved layout and appends blocks it doesn\'t know yet', () => {
    const layout = normalizeLayout({ items: [{ id: 'equity', width: 7 }, { id: 'nope', width: 4 }, { id: 'equity', width: 12 }, { id: 'byHour', width: 2 }], hidden: ['streaks', 'streaks', 'bogus'] })
    expect(layout.items.slice(0, 2)).toEqual([
      { id: 'equity', width: 6 },
      { id: 'byHour', width: 6 },
    ])
    expect(layout.hidden).toEqual(['streaks'])
    expect([...ids(layout), ...layout.hidden].sort()).toEqual([...WIDGET_IDS].sort())
  })

  it('falls back to the default for anything that isn\'t a layout', () => {
    expect(normalizeLayout(undefined)).toEqual(defaultLayout())
    expect(normalizeLayout('x')).toEqual(defaultLayout())
  })

  it('moves a block to another place', () => {
    const moved = moveWidget(defaultLayout(), 'streaks', 0)
    expect(ids(moved).slice(0, 3)).toEqual(['streaks', 'performance', 'tradeCount'])
    expect(ids(moveWidget(defaultLayout(), 'performance', 99)).at(-1)).toBe('performance')
  })

  it('snaps widths to the grid and keeps each block\'s minimum', () => {
    expect(snapWidth('performance', 5)).toBe(4)
    expect(snapWidth('performance', 7)).toBe(6)
    expect(snapWidth('equity', 3)).toBe(6)
    expect(resizeWidget(defaultLayout(), 'tradeCount', 11).items.find((item) => item.id === 'tradeCount')?.width).toBe(12)
  })

  it('steps one width at a time and stops at the ends', () => {
    let layout = defaultLayout()
    layout = stepWidth(layout, 'performance', 1)
    expect(layout.items[0]).toEqual({ id: 'performance', width: 6 })
    layout = stepWidth(stepWidth(stepWidth(layout, 'performance', -1), 'performance', -1), 'performance', -1)
    expect(layout.items[0]).toEqual({ id: 'performance', width: 3 })
  })

  it('hides a block and brings it back at the end', () => {
    const hidden = hideWidget(defaultLayout(), 'calendar')
    expect(ids(hidden)).not.toContain('calendar')
    expect(hidden.hidden).toContain('calendar')
    const shown = showWidget(hidden, 'calendar')
    expect(ids(shown).at(-1)).toBe('calendar')
    expect(shown.hidden).not.toContain('calendar')
  })
})
