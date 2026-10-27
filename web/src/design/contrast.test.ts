import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// WCAG AA contrast for the design tokens (SPEC section 9, principle 6): 4.5:1 for text,
// in both themes. Reads tokens.css itself, so a palette change is checked automatically.

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [match[1]!, match[2]!.toLowerCase()]))
}

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

const dark = block(':root {')
const light = { ...dark, ...block(":root[data-theme='light']") }

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (high + 0.05) / (low + 0.05)
}

// Text color on the backgrounds it's used on.
const TEXT_PAIRS: [text: string, backgrounds: string[]][] = [
  ['color-text-primary', ['color-background', 'color-surface', 'color-surface-elevated']],
  ['color-text-secondary', ['color-background', 'color-surface', 'color-surface-elevated']],
  ['color-accent', ['color-background', 'color-surface', 'color-surface-elevated']],
  ['color-profit', ['color-background', 'color-surface']],
  ['color-loss', ['color-background', 'color-surface']],
  ['color-warning', ['color-background', 'color-surface']],
  ['color-accent-contrast', ['color-accent-fill']],
]

it('defines the light theme the same way for the system setting and the manual switch', () => {
  expect(block(":root:not([data-theme='dark'])")).toEqual(block(":root[data-theme='light']"))
})

describe.each([
  ['dark', dark],
  ['light', light],
])('%s theme', (_name, tokens) => {
  it.each(TEXT_PAIRS.flatMap(([text, backgrounds]) => backgrounds.map((background) => [text, background] as const)))(
    '%s on %s is at least 4.5:1',
    (text, background) => {
      expect(tokens[text], text).toBeDefined()
      expect(tokens[background], background).toBeDefined()
      expect(contrast(tokens[text]!, tokens[background]!)).toBeGreaterThanOrEqual(4.5)
    },
  )
})

// Chart marks are graphics, not text: 3:1 against the card (WCAG 1.4.11).
const MARKS = ['color-chart-profit', 'color-chart-loss']

/** Mixes `share` (0...1) of `color` into `base`, like CSS color-mix in sRGB. */
function mix(color: string, base: string, share: number): string {
  const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16)
  return `#${[1, 3, 5]
    .map((offset) => Math.round(channel(color, offset) * share + channel(base, offset) * (1 - share)).toString(16).padStart(2, '0'))
    .join('')}`
}

describe.each([
  ['dark', dark],
  ['light', light],
])('%s theme charts', (_name, tokens) => {
  it.each(MARKS)('%s is at least 3:1 on the card', (mark) => {
    expect(contrast(tokens[mark]!, tokens['color-surface']!)).toBeGreaterThanOrEqual(3)
  })

  // The calendar fills a day with up to 45% of the mark color (PnlCalendar).
  it.each(MARKS)('text stays readable on the strongest %s calendar day', (mark) => {
    const fill = mix(tokens[mark]!, tokens['color-surface-elevated']!, 0.45)
    expect(contrast(tokens['color-text-primary']!, fill)).toBeGreaterThanOrEqual(4.5)
  })
})

// Side badges and the long/short toggle: tone text on an 8% tint of the card.
describe.each([
  ['dark', dark],
  ['light', light],
])('%s theme tints', (_name, tokens) => {
  it.each(['color-profit', 'color-loss'])('%s text on its own tint is at least 4.5:1', (tone) => {
    const tint = mix(tokens[tone]!, tokens['color-surface']!, 0.08)
    expect(contrast(tokens[tone]!, tint)).toBeGreaterThanOrEqual(4.5)
  })
})

// Control edges (text fields, the chosen segmented option) against what surrounds them.
describe.each([
  ['dark', dark],
  ['light', light],
])('%s theme controls', (_name, tokens) => {
  it.each(['color-background', 'color-surface', 'color-surface-elevated'])('control border on %s is at least 3:1', (background) => {
    expect(contrast(tokens['color-border-control']!, tokens[background]!)).toBeGreaterThanOrEqual(3)
  })
})
