import Big from 'big.js'
import type { ReactNode } from 'react'
import type { Currency } from '../../core/models'
import type { EquityPoint } from '../../core/stats'
import { formatMoney, formatMoneyCompact } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'

// Hand-rolled charts: plain HTML/CSS bars and one SVG line. Every value is also printed as
// text, so the charts read the same with a screen reader and never rely on color alone.

const ZERO = new Big(0)

function share(value: Big, max: Big): number {
  return max.gt(0) ? Number(value.abs().div(max).times(100).toFixed(2)) : 0
}

function tone(value: Big): string {
  return value.gt(0) ? 'profit' : value.lt(0) ? 'loss' : 'neutral'
}

export interface BarItem {
  key: string
  label: ReactNode
  value: Big
  caption?: string
}

/**
 * Horizontal bars for signed values: losses grow left of the axis, profits right, so items
 * on both sides of zero stay comparable.
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
            <span className="bar bar--loss" style={{ width: `${share(item.value, max)}%` }} />
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
}: {
  values: readonly Big[]
  labels: readonly string[]
  currency: Currency
  label: string
  tickEvery?: number
}) {
  const { locale } = useI18n()
  const max = values.reduce((top, value) => (value.abs().gt(top) ? value.abs() : top), ZERO)
  return (
    <figure className="column-chart" aria-label={label}>
      <div className="column-chart__plot">
        {values.map((value, index) => (
          <div key={labels[index]} className="column-chart__column" title={`${labels[index]}: ${formatMoney(value, currency, locale)}`}>
            <div className="column-chart__half">{value.gt(0) && <span className="column column--profit" style={{ height: `${share(value, max)}%` }} />}</div>
            <div className="column-chart__half column-chart__half--negative">
              {value.lt(0) && <span className="column column--loss" style={{ height: `${share(value, max)}%` }} />}
            </div>
          </div>
        ))}
      </div>
      <div className="column-chart__axis" aria-hidden="true">
        {labels.map((text, index) => (
          <span key={text}>{index % tickEvery === 0 ? text : ''}</span>
        ))}
      </div>
      <table className="visually-hidden">
        <tbody>
          {values.map((value, index) => (
            <tr key={labels[index]}>
              <th scope="row">{labels[index]}</th>
              <td>{formatMoney(value, currency, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

const WIDTH = 640
const HEIGHT = 200
const PAD = { top: 12, right: 8, bottom: 12, left: 8 }

/** Cumulative PnL as a line, starting from zero, with the zero level marked. */
export function EquityCurve({ points, currency, label }: { points: readonly EquityPoint[]; currency: Currency; label: string }) {
  const { locale } = useI18n()
  const series = [ZERO, ...points.map((point) => point.equity)].map((value) => Number(value.toFixed(2)))
  const min = Math.min(0, ...series)
  const max = Math.max(0, ...series)
  const range = max - min || 1
  const x = (index: number) => PAD.left + (index / Math.max(series.length - 1, 1)) * (WIDTH - PAD.left - PAD.right)
  const y = (value: number) => PAD.top + ((max - value) / range) * (HEIGHT - PAD.top - PAD.bottom)
  const path = series.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
  const last = points.at(-1)?.equity ?? ZERO
  const area = `${path} L${x(series.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`

  return (
    <figure className="equity-curve">
      <div className="equity-curve__scale caption numeric" aria-hidden="true">
        <span>{formatMoneyCompact(new Big(max), currency, locale)}</span>
        <span>{formatMoneyCompact(new Big(min), currency, locale)}</span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${formatMoney(last, currency, locale)}`}>
        <line className="equity-curve__zero" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} />
        <path className={`equity-curve__area equity-curve__area--${tone(last)}`} d={area} />
        <path className={`equity-curve__line equity-curve__line--${tone(last)}`} d={path} vectorEffect="non-scaling-stroke" />
      </svg>
    </figure>
  )
}
