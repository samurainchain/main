import { Plus, Sun, Wallet } from 'lucide-react'
import { activeAccounts, useJournal, useMistakeName } from '../../app/journal'
import { useSheets } from '../../app/sheets'
import { totalPnl } from '../../core/pnl'
import { closedTrades, mistakeOfTheWeek } from '../../core/stats'
import { Button, Card, EmptyState, PnLText, SectionHeader } from '../../design/components'
import { formatDay, formatMoney } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'
import { PageHeader } from '../shell/PageHeader'
import { dayKey, tradeDayKey, useVisibleTrades } from '../trades/tradeQueries'
import { TradeRow } from '../trades/TradeRow'

/**
 * Today's PnL, the mistake of the week and today's trades (SPEC section 4.3). Limits and
 * the rule streak arrive with the rules stage.
 */
export function TodayPage() {
  const { t, tp, locale } = useI18n()
  const { accounts, mistakes } = useJournal()
  const { trades, currency } = useVisibleTrades()
  const mistakeName = useMistakeName()
  const { newTrade, newAccount } = useSheets()
  const today = new Date()
  const todayTrades = trades
    .filter((trade) => tradeDayKey(trade) === dayKey(today))
    .sort((a, b) => Date.parse(b.closedAt ?? b.openedAt) - Date.parse(a.closedAt ?? a.openedAt))
  const closedCount = todayTrades.filter((trade) => trade.exitPrice !== undefined).length
  const weekMistake = mistakeOfTheWeek(closedTrades(trades), mistakes, today)

  const header = <PageHeader title={t('tab.today')} subtitle={formatDay(today, locale)} showAccountSwitcher />

  if (activeAccounts(accounts).length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<Wallet size={28} />}
          title={t('today.noAccountTitle')}
          message={t('today.noAccountMessage')}
          action={
            <Button variant="primary" block icon={<Plus size={20} aria-hidden="true" />} onClick={newAccount}>
              {t('accounts.create')}
            </Button>
          }
        />
      </>
    )
  }

  return (
    <>
      {header}
      <Card className="today-summary">
        <p className="caption">{t('today.pnlLabel')}</p>
        <PnLText amount={totalPnl(todayTrades)} currency={currency} size="hero" />
        <p className="secondary-text">{tp('today.tradeCount', closedCount)}</p>
      </Card>

      {weekMistake && (
        <Card className="week-mistake">
          <p className="caption">{t('today.weekMistake')}</p>
          <p className="week-mistake__row">
            <span className="week-mistake__name">{mistakeName(weekMistake.tag)}</span>
            <span className="loss numeric">{formatMoney(weekMistake.cost.times(-1), currency, locale)}</span>
          </p>
          <p className="caption">{tp('today.weekMistakeTrades', weekMistake.tradeCount)}</p>
        </Card>
      )}

      {todayTrades.length === 0 ? (
        <EmptyState
          icon={<Sun size={28} />}
          title={t('today.emptyTitle')}
          message={t('today.emptyMessage')}
          action={
            <Button variant="primary" block icon={<Plus size={20} aria-hidden="true" />} onClick={newTrade}>
              {t('action.newTrade')}
            </Button>
          }
        />
      ) : (
        <>
          <SectionHeader title={t('today.tradesSection')} />
          <div className="list-card">
            {todayTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
