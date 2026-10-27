import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CloudController, CloudProvider } from './app/cloud'
import { registerServiceWorker } from './app/install'
import { JournalProvider } from './app/journal'
import { SheetProvider } from './app/sheets'
import { IndexedDbBackend } from './core/storage/indexedDbBackend'
import { JournalStore } from './core/storage/journalStore'
import { SyncingBackend } from './core/sync/cloudSync'
import './design/tokens.css'
import './design/base.css'
import './design/components.css'
import './features/shell/shell.css'
import './features/analytics/analytics.css'
import './features/onboarding/onboarding.css'
import { AppShell } from './features/shell/AppShell'
import { I18nProvider } from './i18n/i18n'

const local = new IndexedDbBackend()
const backend = new SyncingBackend(local, local.syncState())
const store = new JournalStore(backend, local.imageBlobs())
const cloud = new CloudController(backend, store)
void store.load().then(() => cloud.start())
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JournalProvider store={store}>
      <CloudProvider value={cloud}>
        <I18nProvider>
          <SheetProvider>
            <AppShell />
          </SheetProvider>
        </I18nProvider>
      </CloudProvider>
    </JournalProvider>
  </StrictMode>,
)
