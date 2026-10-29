import Big from 'big.js'
import type { Currency, MistakeTag } from '../../core/models'
import type { Recap } from '../../core/recap'
import { formatDay, formatMoney, formatMonth, formatR, formatRatio, formatShare, formatWeekRange, weekdayNames } from '../../i18n/format'
import type { Locale, Translator } from '../../i18n/i18n'
import { COLORS, fit, MONO, roundRect, SANS, type Tone } from './shareCard'

// The picture of a day's, week's or month's results (SPEC section 4.6). Its text is built here
// and tested; drawRecapCard puts it on a 1080×1350 canvas (4:5, the feed's tallest shape).

export const RECAP_WIDTH = 1080
export const RECAP_HEIGHT = 1350

export interface RecapCard {
  label: string
  period: string
  hero: { text: string; tone: Tone; caption?: string }
  /** -1…1, scaled to the largest bar. */
  bars: number[]
  /** Under the bars of a week: the weekdays. */
  barLabels?: string[]
  stats: { label: string; value: string; tone?: Tone }[]
  leak?: { label: string; name: string; detail: string }
  empty?: string
  tagline: string
}

const tone = (value: Big | undefined): Tone => (!value || value.eq(0) ? 'neutral' : value.gt(0) ? 'profit' : 'loss')

export function buildRecapCard(
  recap: Recap,
  currency: Currency,
  hideAmount: boolean,
  t: Translator['t'],
  tp: Translator['tp'],
  locale: Locale,
  mistakeName: (tag: MistakeTag) => string,
): RecapCard {
  const { metrics: m, span, range } = recap
  const money = (amount: Big) => formatMoney(amount, currency, locale)
  const period = span === 'day' ? formatDay(range.start, locale) : span === 'week' ? formatWeekRange(range.start, locale) : formatMonth(range.start, locale)
  const dash = '—'

  let hero: RecapCard['hero']
  if (!hideAmount) hero = { text: money(m.pnl), tone: tone(m.pnl) }
  else if (recap.totalR && recap.rCount === m.count) hero = { text: formatR(recap.totalR, locale), tone: tone(recap.totalR), caption: t('recap.totalR') }
  else hero = { text: m.winRate ? formatShare(m.winRate, locale) : dash, tone: 'neutral', caption: t('recap.winRate') }

  const largest = recap.bars.reduce((most, bar) => (bar.abs().gt(most) ? bar.abs() : most), new Big(0))
  const bars = recap.bars.map((bar) => (largest.eq(0) ? 0 : Number(bar.div(largest).toFixed(4))))
  let barLabels: string[] | undefined
  if (span === 'week') {
    const names = weekdayNames(locale, 'narrow')
    barLabels = recap.bars.map((_, index) => names[(range.start.getDay() + index) % 7]!)
  }

  const count = { label: t('recap.trades'), value: String(m.count) }
  const winRate = { label: t('recap.winRate'), value: m.winRate ? formatShare(m.winRate, locale) : dash }
  const stats: RecapCard['stats'] = hideAmount
    ? [
        count,
        ...(hero.caption === t('recap.winRate') ? [] : [winRate]),
        { label: t('recap.averageR'), value: m.averageR ? formatR(m.averageR, locale) : dash, tone: tone(m.averageR) },
        { label: t('recap.profitFactor'), value: m.profitFactor ? formatRatio(m.profitFactor, locale) : dash },
      ]
    : [
        count,
        winRate,
        { label: t('recap.best'), value: recap.best ? money(recap.best.pnl) : dash, tone: tone(recap.best?.pnl) },
        { label: t('recap.worst'), value: recap.worst ? money(recap.worst.pnl) : dash, tone: tone(recap.worst?.pnl) },
      ]

  const top = recap.topMistake
  const trades = top ? tp('recap.leakTrades', top.tradeCount) : ''
  return {
    label: t(`recap.label.${span}`),
    period,
    hero,
    bars,
    barLabels,
    stats,
    leak: top ? { label: t('recap.leak'), name: mistakeName(top.tag), detail: hideAmount ? trades : `${money(top.cost.times(-1))} · ${trades}` } : undefined,
    empty: m.count === 0 ? t('recap.empty') : undefined,
    tagline: t('share.tagline'),
  }
}

const toneColor = (value: Tone | undefined) => (value === 'profit' ? COLORS.profit : value === 'loss' ? COLORS.loss : COLORS.text)

/** Draws the recap on a 1080×1350 canvas. `logo` is the app icon, already loaded. */
export function drawRecapCard(ctx: CanvasRenderingContext2D, card: RecapCard, logo: CanvasImageSource | undefined): void {
  const width = RECAP_WIDTH
  const height = RECAP_HEIGHT
  const pad = 80
  const inner = width - pad * 2
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.background
  ctx.fillRect(0, 0, width, height)
  roundRect(ctx, 32, 32, width - 64, height - 64, 28)
  ctx.fillStyle = COLORS.surface
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = COLORS.border
  ctx.stroke()

  // Brand, label and period
  if (logo) ctx.drawImage(logo, pad, pad - 4, 56, 56)
  ctx.fillStyle = COLORS.text
  ctx.font = `600 36px ${SANS}`
  ctx.fillText('Tiltless', pad + (logo ? 72 : 0), pad + 38)
  ctx.fillStyle = COLORS.accent
  ctx.font = `500 22px ${MONO}`
  ctx.textAlign = 'right'
  ctx.fillText(card.label.toUpperCase(), width - pad, pad + 34)
  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.secondary
  fit(ctx, card.period, 500, 40, SANS, inner)
  ctx.fillText(card.period, pad, 230)

  // Result
  ctx.fillStyle = toneColor(card.hero.tone)
  fit(ctx, card.hero.text, 600, 160, SANS, inner)
  ctx.fillText(card.hero.text, pad - 6, 400)
  if (card.hero.caption) {
    ctx.fillStyle = COLORS.secondary
    ctx.font = `500 24px ${MONO}`
    ctx.fillText(card.hero.caption.toUpperCase(), pad, 450)
  }

  // Bars around a zero line
  const chartTop = 490
  const chartHeight = 280
  const zero = chartTop + chartHeight / 2
  ctx.fillStyle = COLORS.border
  ctx.fillRect(pad, zero - 1, inner, 2)
  if (card.empty) {
    ctx.fillStyle = COLORS.secondary
    ctx.textAlign = 'center'
    fit(ctx, card.empty, 500, 34, SANS, inner)
    ctx.fillText(card.empty, width / 2, zero - 24)
    ctx.textAlign = 'left'
  } else if (card.bars.length > 0) {
    const slot = inner / card.bars.length
    const barWidth = Math.max(4, Math.min(72, slot * 0.62))
    card.bars.forEach((value, index) => {
      const x = pad + slot * index + (slot - barWidth) / 2
      const length = Math.abs(value) * (chartHeight / 2 - 8)
      if (length < 1) return
      ctx.fillStyle = value > 0 ? COLORS.profit : COLORS.loss
      roundRect(ctx, x, value > 0 ? zero - length : zero, barWidth, length, Math.min(8, barWidth / 2))
      ctx.fill()
    })
    if (card.barLabels) {
      ctx.fillStyle = COLORS.secondary
      ctx.font = `500 24px ${MONO}`
      ctx.textAlign = 'center'
      card.barLabels.forEach((label, index) => ctx.fillText(label.toUpperCase(), pad + slot * index + slot / 2, chartTop + chartHeight + 40))
      ctx.textAlign = 'left'
    }
  }

  // Stats in a 2×2 grid
  const gridTop = 860
  const column = inner / 2
  card.stats.slice(0, 4).forEach((stat, index) => {
    const x = pad + (index % 2) * column
    const y = gridTop + Math.floor(index / 2) * 120
    ctx.fillStyle = COLORS.secondary
    fit(ctx, stat.label.toUpperCase(), 500, 22, MONO, column - 24)
    ctx.fillText(stat.label.toUpperCase(), x, y)
    ctx.fillStyle = toneColor(stat.tone)
    fit(ctx, stat.value, 600, 50, SANS, column - 24)
    ctx.fillText(stat.value, x, y + 58)
  })

  // The mistake that cost most
  if (card.leak) {
    const top = 1110
    roundRect(ctx, pad, top, inner, 96, 18)
    ctx.fillStyle = COLORS.leakSurface
    ctx.fill()
    ctx.strokeStyle = COLORS.leakBorder
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = COLORS.loss
    ctx.font = `500 22px ${MONO}`
    ctx.fillText(card.leak.label.toUpperCase(), pad + 28, top + 38)
    ctx.fillStyle = COLORS.text
    fit(ctx, card.leak.name, 600, 32, SANS, inner / 2 - 40)
    ctx.fillText(card.leak.name, pad + 28, top + 78)
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.loss
    fit(ctx, card.leak.detail, 600, 32, SANS, inner / 2 - 40)
    ctx.fillText(card.leak.detail, width - pad - 28, top + 78)
    ctx.textAlign = 'left'
  }

  // Footer
  ctx.fillStyle = COLORS.accent
  ctx.font = `600 32px ${SANS}`
  ctx.fillText('tiltless.xyz', pad, height - 82)
  ctx.fillStyle = COLORS.secondary
  ctx.textAlign = 'right'
  fit(ctx, card.tagline, 400, 26, SANS, inner - 260)
  ctx.fillText(card.tagline, width - pad, height - 84)
  ctx.textAlign = 'left'
}
