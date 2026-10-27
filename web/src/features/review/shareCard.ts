// Renders the weekly review as a 1080×1920 image for stories and messengers (SPEC 4.9).
// Colors and font come from the design tokens, read from CSS at render time.

export interface ShareCardContent {
  brand: string
  weekLabel: string
  /** The big number: total R, or win rate when no trade had a stop. */
  headline: string
  headlineLabel: string
  headlineTone: 'profit' | 'loss' | 'neutral'
  rows: { label: string; value: string; tone?: 'profit' | 'loss' }[]
  ruleLabel?: string
  rule?: string
  footer: string
}

const WIDTH = 1080
const HEIGHT = 1920
const MARGIN = 96

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/\s+\S*$/, '')}…`
  return kept
}

export function renderShareCard(content: ShareCardContent): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return canvas

  const colors = {
    background: token('--color-background'),
    surface: token('--color-surface'),
    text: token('--color-text-primary'),
    secondary: token('--color-text-secondary'),
    accent: token('--color-accent'),
    profit: token('--color-profit'),
    loss: token('--color-loss'),
    separator: token('--color-separator'),
  }
  const font = token('--font-body')
  const rounded = token('--font-rounded')
  const toneColor = (tone?: 'profit' | 'loss' | 'neutral') => (tone === 'profit' ? colors.profit : tone === 'loss' ? colors.loss : colors.text)

  context.fillStyle = colors.background
  context.fillRect(0, 0, WIDTH, HEIGHT)
  const glow = context.createRadialGradient(WIDTH * 0.85, 0, 0, WIDTH * 0.85, 0, WIDTH)
  glow.addColorStop(0, `${colors.accent}55`)
  glow.addColorStop(1, `${colors.accent}00`)
  context.fillStyle = glow
  context.fillRect(0, 0, WIDTH, HEIGHT)

  context.fillStyle = colors.accent
  context.font = `700 44px ${font}`
  context.fillText(content.brand, MARGIN, 180)
  context.fillStyle = colors.secondary
  context.font = `500 40px ${font}`
  context.fillText(content.weekLabel, MARGIN, 248)

  context.fillStyle = colors.secondary
  context.font = `600 36px ${font}`
  context.fillText(content.headlineLabel.toUpperCase(), MARGIN, 470)
  context.fillStyle = toneColor(content.headlineTone)
  context.font = `700 200px ${rounded}`
  context.fillText(content.headline, MARGIN - 8, 660)

  let y = 820
  for (const row of content.rows) {
    context.fillStyle = colors.separator
    context.fillRect(MARGIN, y - 64, WIDTH - MARGIN * 2, 2)
    context.fillStyle = colors.secondary
    context.font = `500 40px ${font}`
    context.fillText(row.label, MARGIN, y)
    context.fillStyle = toneColor(row.tone)
    context.font = `600 44px ${font}`
    const value = wrap(context, row.value, (WIDTH - MARGIN * 2) / 2, 1)[0] ?? ''
    context.textAlign = 'right'
    context.fillText(value, WIDTH - MARGIN, y)
    context.textAlign = 'left'
    y += 116
  }

  if (content.rule && content.ruleLabel) {
    y += 40
    context.font = `600 48px ${font}`
    const lines = wrap(context, `“${content.rule}”`, WIDTH - MARGIN * 2 - 96, 4)
    const boxHeight = 120 + lines.length * 64
    context.fillStyle = colors.surface
    context.beginPath()
    context.roundRect(MARGIN, y, WIDTH - MARGIN * 2, boxHeight, 40)
    context.fill()
    context.fillStyle = colors.secondary
    context.font = `600 32px ${font}`
    context.fillText(content.ruleLabel.toUpperCase(), MARGIN + 48, y + 72)
    context.fillStyle = colors.text
    context.font = `600 48px ${font}`
    lines.forEach((line, index) => context.fillText(line, MARGIN + 48, y + 140 + index * 64))
  }

  context.fillStyle = colors.secondary
  context.font = `500 32px ${font}`
  context.textAlign = 'center'
  context.fillText(content.footer, WIDTH / 2, HEIGHT - 96)
  context.textAlign = 'left'
  return canvas
}

/** Opens the system share sheet with the image, or downloads it where sharing files isn't supported. */
export async function shareCard(canvas: HTMLCanvasElement, fileName: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not render the card')
  const file = new File([blob], fileName, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      throw error
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
