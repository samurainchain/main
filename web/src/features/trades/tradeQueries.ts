import type Big from 'big.js'
import { useMemo } from 'react'
import { useJournal, useSelectedAccount } from '../../app/journal'
import type { Account, Currency, Trade } from '../../core/models'
import { totalPnl } from '../../core/pnl'

/** Local calendar day a trade counts toward: its exit, or its entry while open. */
export function tradeDayKey(trade: Trade): string {
  const date = new Date(trade.closedAt ?? trade.openedAt)
  return dayKey(date)
}

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function dayFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year!, month! - 1, day!)
}

function tradeTime(trade: Trade): number {
  return Date.parse(trade.closedAt ?? trade.openedAt)
}

export interface TradeDay {
  key: string
  date: Date
  trades: Trade[]
  pnl: Big
}

/** Groups trades by local day, newest day first and newest trade first within a day. */
export function groupByDay(trades: readonly Trade[]): TradeDay[] {
  const groups = new Map<string, Trade[]>()
  for (const trade of [...trades].sort((a, b) => tradeTime(b) - tradeTime(a))) {
    const key = tradeDayKey(trade)
    groups.set(key, [...(groups.get(key) ?? []), trade])
  }
  return [...groups].map(([key, dayTrades]) => ({ key, date: dayFromKey(key), trades: dayTrades, pnl: totalPnl(dayTrades) }))
}

/** Currency for totals: the selected account's, or the one all accounts share; USD otherwise. */
export function totalsCurrency(selected: Account | undefined, accounts: readonly Account[]): Currency {
  if (selected) return selected.currency
  const currencies = new Set(accounts.map((account) => account.currency))
  return currencies.size === 1 ? [...currencies][0]! : 'USD'
}

/** Trades of the account picked in the switcher, or of all accounts. */
export function useVisibleTrades(): { trades: Trade[]; currency: Currency; selected: Account | undefined } {
  const { trades, accounts } = useJournal()
  const selected = useSelectedAccount()
  return useMemo(
    () => ({
      trades: selected ? trades.filter((trade) => trade.accountId === selected.id) : trades,
      currency: totalsCurrency(selected, accounts),
      selected,
    }),
    [trades, accounts, selected],
  )
}
