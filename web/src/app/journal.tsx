import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { Account, MistakeTag } from '../core/models'
import type { JournalSnapshot, JournalStore } from '../core/storage/journalStore'
import { useI18n } from '../i18n/i18n'
import type { MessageKey } from '../i18n/messages/en'
import { useSettings } from './settings'

const StoreContext = createContext<JournalStore | null>(null)

export function JournalProvider({ store, children }: { store: JournalStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): JournalStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside JournalProvider')
  return store
}

export function useJournal(): JournalSnapshot {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

export function activeAccounts(accounts: readonly Account[]): Account[] {
  return accounts.filter((account) => !account.isArchived)
}

/**
 * The account chosen in the switcher, or undefined for "All accounts". Falls back to all
 * when the remembered account no longer exists.
 */
export function useSelectedAccount(): Account | undefined {
  const { accounts } = useJournal()
  const { selectedAccount } = useSettings()
  if (selectedAccount === 'all') {
    const active = activeAccounts(accounts)
    return active.length === 1 ? active[0] : undefined
  }
  return accounts.find((account) => account.id === selectedAccount)
}

/** Display name of a mistake tag: the user's name, or the translated system name. */
export function useMistakeName(): (tag: MistakeTag) => string {
  const { t } = useI18n()
  return (tag) => tag.name || (tag.systemKey ? t(`mistake.${tag.systemKey}` as MessageKey) : '')
}
