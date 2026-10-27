import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { JournalProvider } from './app/journal'
import { SheetProvider } from './app/sheets'
import { IndexedDbBackend } from './core/storage/indexedDbBackend'
import { JournalStore } from './core/storage/journalStore'
import './design/tokens.css'
import './design/base.css'
import './design/components.css'
import './features/shell/shell.css'
import './features/analytics/analytics.css'
import { AppShell } from './features/shell/AppShell'
import { I18nProvider } from './i18n/i18n'

const store = new JournalStore(new IndexedDbBackend())
void store.load()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JournalProvider store={store}>
      <I18nProvider>
        <SheetProvider>
          <AppShell />
        </SheetProvider>
      </I18nProvider>
    </JournalProvider>
  </StrictMode>,
)
