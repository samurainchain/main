import Big from 'big.js'
import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { Currency } from '../../core/models'
import type { EquityPoint } from '../../core/stats'
import { formatDateTime, formatMoney, formatMoneyCompact } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'

// Hand-rolled charts: plain HTML/CSS bars and one SVG line. Every value is also printed as
// text or kept in a screen-reader table, so the charts never rely on color or hover alone.
// Marks follow one spec: thin bars rounded only at the value end, hairline solid axes,
// a 2px line with an end dot, and a hover/keyboard readout on the column and line charts.

const ZERO = new Big(0)

function share(value: Big, max: Big): number {
  return max.gt(0) ? Number(value.abs().div(max).times(100).toFixed(2)) : 0
}

function tone(value: Big): string {
  return value.gt(0) ? 'profit' : value.lt(0) ? 'loss' : 'neutral'
}

/**
 * The highlighted position of a chart with `count` slots: follows the pointer, and arrow keys
 * move it when the plot has focus, so keyboard users get the same readout as mouse users.
 */
function useCursor(count: number, first = 0) {
  const [index, setIndex] = useState<number>()
  const clamp = (value: number) => Math.min(count - 1, Math.max(first, value))
  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, () => number | undefined> = {
      ArrowRight: () => clamp((index ?? first - 1) + 1),
      ArrowLeft: () => clamp((index ?? count) - 1),
      Home: () => first,
      End: () => count - 1,
      Escape: () => undefined,
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    setIndex(move())
  }
  return {
    index,
    /** Picks the slot under the pointer from its share of the plot width (0...1). */
    pointAt: (event: PointerEvent<HTMLElement>, toIndex: (fraction: number) => number) => {
      const box = event.currentTarget.getBoundingClientRect()
      setIndex(clamp(toIndex((event.clientX - box.left) / box.width)))
    },
    clear: () => setIndex(undefined),
    keyboard: { tabIndex: 0, onKeyDown, onBlur: () => setIndex(undefined) },
  }
}

/** Readout above a plot at `x` percent of its width: the value leads, the label follows. */
function ChartTooltip({ x, value, label, tone: valueTone }: { x: number; value: string; label: string; tone: string }) {
  const align = x < 20 ? 'start' : x > 80 ? 'end' : 'center'
  return (
    <div className={`chart-tooltip chart-tooltip--${align}`} style={{ left: `${x}%` }} aria-hidden="true">
      <span className={`chart-tooltip__key chart-tooltip__key--${valueTone}`} />
      <span className="chart-tooltip__value numeric">{value}</span>
      <span className="chart-tooltip__label">{label}</span>
    </div>
  )
}

export interface BarItem {
  key: string
  label: ReactNode
  value: Big
  caption?: string
}

/**
 * Horizontal bars for signed values: losses grow left of the axis, profits right, so items
 * on both sides of zero stay comparable. Every row prints its value, so no tooltip is needed.
 */
export function SignedBarList({ items, currency }: { items: readonly BarItem[]; currency: Currency }) {
  const { locale } = useI18n()
  const max = items.reduce((top, item) => (item.value.abs().gt(top) ? item.value.abs() : top), ZERO)
  return (
    <ul className="bar-list">
      {items.map((item) => (
        <li key={item.key} className="bar-list__row">
          <div className="bar-list__label">
            <span>{item.label}</span>
            {item.caption && <span className="caption">{item.caption}</span>}
          </div>
          <div className="signed-bar" aria-hidden="true">
            <div className="signed-bar__half signed-bar__half--negative">
              {item.value.lt(0) && <span className="bar bar--loss" style={{ width: `${share(item.value, max)}%` }} />}
            </div>
            <div className="signed-bar__half">
              {item.value.gt(0) && <span className="bar bar--profit" style={{ width: `${share(item.value, max)}%` }} />}
            </div>
          </div>
          <span className={`bar-list__value numeric ${tone(item.value)}`}>{formatMoney(item.value, currency, locale)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Horizontal bars for amounts that are all losses, e.g. the cost of each mistake. */
export function CostBarList({ items, currency }: { items: readonly BarItem[]; currency: Currency }) {
  const { locale } = useI18n()
  const max = items.reduce((top, item) => (item.value.gt(top) ? item.value : top), ZERO)
  return (
    <ul className="bar-list">
      {items.map((item) => (
        <li key={item.key} className="bar-list__row bar-list__row--cost">
          <div className="bar-list__label">
            <span>{item.label}</span>
            {item.caption && <span className="caption">{item.caption}</span>}
          </div>
          <div className="cost-bar" aria-hidden="true">
            <span className="bar bar--loss bar--cost" style={{ width: `${share(item.value, max)}%` }} />
          </div>
          <span className="bar-list__value numeric loss">{formatMoney(item.value.times(-1), currency, locale)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Vertical bars around a zero line, one per bucket (hours of the day). */
export function ColumnChart({
  values,
  labels,
  currency,
  label,
  tickEvery = 1,
  formatLabel = (text) => text,
}: {
  values: readonly Big[]
  labels: readonly string[]
  currency: Currency
  label: string
  tickEvery?: number
  /** The bucket name in the readout, e.g. "09" -> "09:00". */
  formatLabel?: (label: string) => string
}) {
  const { locale } = useI18n()
  const max = values.reduce((top, value) => (value.abs().gt(top) ? value.abs() : top), ZERO)
  const cursor = useCursor(values.length)
  const active = cursor.index === undefined ? undefined : values[cursor.index]
  return (
    <figure className="column-chart">
      <div
        className="column-chart__plot"
        aria-label={label}
        role="group"
        {...cursor.keyboard}
        onPointerMove={(event) => cursor.pointAt(event, (fraction) => Math.floor(fraction * values.length))}
        onPointerLeave={cursor.clear}
      >
        {values.map((value, index) => (
          <div key={labels[index]} className={`column-chart__column${cursor.index === index ? ' column-chart__column--active' : ''}`}>
            <div className="column-chart__half">{value.gt(0) && <span className="column column--profit" style={{ height: `${share(value, max)}%` }} />}</div>
            <div className="column-chart__half column-chart__half--negative">
              {value.lt(0) && <span className="column column--loss" style={{ height: `${share(value, max)}%` }} />}
            </div>
          </div>
        ))}
        {active && cursor.index !== undefined && (
          <ChartTooltip
            x={((cursor.index + 0.5) / values.length) * 100}
            value={formatMoney(active, currency, locale)}
            label={formatLabel(labels[cursor.index]!)}
            tone={tone(active)}
          />
        )}
      </div>
      <div className="column-chart__axis" aria-hidden="true">
        {labels.map((text, index) => (
          <span key={text}>{index % tickEvery === 0 ? text : ''}</span>
        ))}
      </div>
      {/* A div, not the table, is the clipped box: a table grows to fit its cells. */}
      <div className="visually-hidden">
        <table>
          <tbody>
            {values.map((value, index) => (
              <tr key={labels[index]}>
                <th scope="row">{formatLabel(labels[index]!)}</th>
                <td>{formatMoney(value, currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

const WIDTH = 640
const HEIGHT = 200
const PAD = { top: 12, right: 12, bottom: 12, left: 8 }

/**
 * Cumulative PnL as a line, starting from zero, with the zero level marked and the latest
 * value labeled. A crosshair snaps to the nearest trade under the pointer or arrow keys.
 */
export function EquityCurve({ points, currency, label }: { points: readonly EquityPoint[]; currency: Currency; label: string }) {
  const { locale } = useI18n()
  const series = [ZERO, ...points.map((point) => point.equity)].map((value) => Number(value.toFixed(2)))
  const min = Math.min(0, ...series)
  const max = Math.max(0, ...series)
  const range = max - min || 1
  const plotWidth = WIDTH - PAD.left - PAD.right
  const x = (index: number) => PAD.left + (index / Math.max(series.length - 1, 1)) * plotWidth
  const y = (value: number) => PAD.top + ((max - value) / range) * (HEIGHT - PAD.top - PAD.bottom)
  const path = series.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
  const last = points.at(-1)?.equity ?? ZERO
  const area = `${path} L${x(series.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
  // Slot 0 is the zero start, not a trade, so the cursor only visits slots 1...n.
  const cursor = useCursor(series.length, 1)
  const toPercent = (index: number) => ({ left: `${(x(index) / WIDTH) * 100}%`, top: `${(y(series[index]!) / HEIGHT) * 100}%` })
  const end = series.length - 1
  const activePoint = cursor.index === undefined ? undefined : points[cursor.index - 1]

  return (
    <figure className="equity-curve">
      <div className="equity-curve__body">
        <div
          className="equity-curve__plot"
          role="group"
          aria-label={`${label}: ${formatMoney(last, currency, locale)}`}
          {...cursor.keyboard}
          onPointerMove={(event) => cursor.pointAt(event, (fraction) => Math.round(((fraction * WIDTH - PAD.left) / plotWidth) * end))}
          onPointerLeave={cursor.clear}
        >
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            <line className="equity-curve__zero" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} vectorEffect="non-scaling-stroke" />
            <path className={`equity-curve__area equity-curve__area--${tone(last)}`} d={area} />
            <path className={`equity-curve__line equity-curve__line--${tone(last)}`} d={path} vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Dots and the crosshair live in HTML so they stay round while the SVG stretches. */}
          {activePoint && cursor.index !== undefined && (
            <>
              <span className="equity-curve__crosshair" style={{ left: toPercent(cursor.index).left }} aria-hidden="true" />
              <span className={`equity-curve__dot equity-curve__dot--${tone(last)}`} style={toPercent(cursor.index)} aria-hidden="true" />
              <ChartTooltip
                x={(x(cursor.index) / WIDTH) * 100}
                value={formatMoney(activePoint.equity, currency, locale)}
                label={formatDateTime(activePoint.at.toISOString(), locale)}
                tone={tone(last)}
              />
            </>
          )}
          {end > 0 && cursor.index !== end && (
            <span className={`equity-curve__dot equity-curve__dot--${tone(last)}`} style={toPercent(end)} aria-hidden="true" />
          )}
        </div>
        <div className="equity-curve__scale caption numeric" aria-hidden="true">
          <span>{formatMoneyCompact(new Big(max), currency, locale)}</span>
          <span>{formatMoneyCompact(new Big(min), currency, locale)}</span>
        </div>
      </div>
      <figcaption className="equity-curve__end">
        <span className={`numeric ${tone(last)}`}>{formatMoney(last, currency, locale)}</span>
      </figcaption>
      <div className="visually-hidden">
        <table>
          <tbody>
            {points.map((point, index) => (
              <tr key={index}>
                <th scope="row">{formatDateTime(point.at.toISOString(), locale)}</th>
                <td>{formatMoney(point.equity, currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
