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
  ['color-accent', ['color-background', 'color-surface']],
  ['color-profit', ['color-background', 'color-surface']],
  ['color-loss', ['color-background', 'color-surface']],
  ['color-warning', ['color-background', 'color-surface']],
  ['color-accent-contrast', ['color-accent']],
  ['color-on-profit', ['color-profit']],
  ['color-on-loss', ['color-loss']],
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
