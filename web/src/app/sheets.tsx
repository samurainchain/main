import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

/** Which global sheet is open: trade entry (new or edit) or the account form. */
export type OpenSheet =
  | { kind: 'none' }
  | { kind: 'trade'; tradeId?: string }
  | { kind: 'account'; accountId?: string }

interface SheetActions {
  sheet: OpenSheet
  newTrade(): void
  editTrade(id: string): void
  newAccount(): void
  editAccount(id: string): void
  close(): void
}

const SheetContext = createContext<SheetActions | null>(null)

export function SheetProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<OpenSheet>({ kind: 'none' })
  const actions = useMemo<SheetActions>(
    () => ({
      sheet,
      newTrade: () => setSheet({ kind: 'trade' }),
      editTrade: (tradeId) => setSheet({ kind: 'trade', tradeId }),
      newAccount: () => setSheet({ kind: 'account' }),
      editAccount: (accountId) => setSheet({ kind: 'account', accountId }),
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
