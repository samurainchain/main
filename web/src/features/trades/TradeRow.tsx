import { BadgeCheck, CircleDollarSign, Flame, Hourglass, Leaf, Rabbit, TriangleAlert, type LucideIcon } from 'lucide-react'
import { routeHref } from '../../app/router'
import { useJournal, useMistakeName } from '../../app/journal'
import type { Emotion, Trade } from '../../core/models'
import { rMultiple, tradePnl } from '../../core/pnl'
import { Chip, PnLText } from '../../design/components'
import { formatR, formatTime } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'

export const EMOTION_ICONS: Record<Emotion, LucideIcon> = {
  calm: Leaf,
  confident: BadgeCheck,
  fomo: Rabbit,
  anger: Flame,
  boredom: Hourglass,
  fear: TriangleAlert,
  greed: CircleDollarSign,
}

/** One trade in a list: pair, side, PnL in money and R, emotion and mistake chips. */
export function TradeRow({ trade }: { trade: Trade }) {
  const { t, locale } = useI18n()
  const { accounts, mistakes } = useJournal()
  const mistakeName = useMistakeName()
  const account = accounts.find((item) => item.id === trade.accountId)
  const pnl = tradePnl(trade)
  const r = rMultiple(trade)
  const tags = mistakes.filter((tag) => trade.mistakeIds.includes(tag.id))
  const EmotionIcon = trade.emotion ? EMOTION_ICONS[trade.emotion] : undefined

  return (
    <a className="trade-row" href={routeHref({ name: 'trade', id: trade.id })}>
      <div className="trade-row__main">
        <div className="trade-row__title">
          <span className="trade-row__symbol">{trade.symbol}</span>
          <span className={`side-badge side-badge--${trade.side}`}>{t(`side.${trade.side}`)}</span>
          {EmotionIcon && (
            <span className="trade-row__emotion" title={t(`emotion.${trade.emotion!}`)}>
              <EmotionIcon size={16} aria-hidden="true" />
              <span className="visually-hidden">{t(`emotion.${trade.emotion!}`)}</span>
            </span>
          )}
        </div>
        <div className="trade-row__meta caption">
          {formatTime(trade.closedAt ?? trade.openedAt, locale)}
          {account && ` · ${account.name}`}
        </div>
        {tags.length > 0 && (
          <div className="chip-row trade-row__tags">
            {tags.map((tag) => (
              <Chip key={tag.id} label={mistakeName(tag)} colorHex={tag.colorHex} selected={false} />
            ))}
          </div>
        )}
      </div>
      <div className="trade-row__result">
        {pnl ? <PnLText amount={pnl} currency={account?.currency ?? 'USD'} /> : <span className="caption">{t('trade.open')}</span>}
        {r && <span className="caption numeric">{formatR(r, locale)}</span>}
      </div>
    </a>
  )
}
