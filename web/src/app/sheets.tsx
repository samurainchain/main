import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

/** Fields a new trade can start with, e.g. from the position size calculator. */
export interface TradePrefill {
  accountId?: string
  side?: 'long' | 'short'
  symbol?: string
  contract?: string
  multiplier?: string
  leverage?: number
  entryPrice?: string
  stopLoss?: string
  size?: string
}

/** Which global sheet is open: trade entry (new or edit), the account form or the position size calculator. */
export type OpenSheet =
  | { kind: 'none' }
  | { kind: 'trade'; tradeId?: string; prefill?: TradePrefill }
  | { kind: 'account'; accountId?: string }
  | { kind: 'calculator' }

interface SheetActions {
  sheet: OpenSheet
  newTrade(): void
  /** A new trade with some fields already filled in. */
  newTradeFrom(prefill: TradePrefill): void
  editTrade(id: string): void
  newAccount(): void
  editAccount(id: string): void
  openCalculator(): void
  close(): void
}

const SheetContext = createContext<SheetActions | null>(null)

export function SheetProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<OpenSheet>({ kind: 'none' })
  const actions = useMemo<SheetActions>(
    () => ({
      sheet,
      newTrade: () => setSheet({ kind: 'trade' }),
      newTradeFrom: (prefill) => setSheet({ kind: 'trade', prefill }),
      editTrade: (tradeId) => setSheet({ kind: 'trade', tradeId }),
      newAccount: () => setSheet({ kind: 'account' }),
      editAccount: (accountId) => setSheet({ kind: 'account', accountId }),
      openCalculator: () => setSheet({ kind: 'calculator' }),
      close: () => setSheet({ kind: 'none' }),
    }),
    [sheet],
  )
  return <SheetContext.Provider value={actions}>{children}</SheetContext.Provider>
}

export function useSheets(): SheetActions {
  const actions = useContext(SheetContext)
  if (!actions) throw new Error('useSheets must be used inside SheetProvider')
  return actions
}
