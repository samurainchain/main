import { ChartColumn, CircleUser, ListChecks, Plus, Sun, type LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useJournal } from '../../app/journal'
import { useLimitAlerts } from '../../app/limitAlerts'
import { routeHref, useRoute, type Route } from '../../app/router'
import { useSettings } from '../../app/settings'
import { useSheets } from '../../app/sheets'
import { useI18n } from '../../i18n/i18n'
import type { MessageKey } from '../../i18n/messages/en'
import { AccountSheet } from '../accounts/AccountSheet'
import { AccountsPage } from '../accounts/AccountsPage'
import { AnalyticsPage } from '../analytics/AnalyticsPage'
import { TradeEntrySheet } from '../entry/TradeEntrySheet'
import { ProfilePage } from '../profile/ProfilePage'
import { WeeklyReviewPage } from '../review/WeeklyReviewPage'
import { RulesPage } from '../rules/RulesPage'
import { TodayPage } from '../today/TodayPage'
import { TradeDetailPage } from '../trades/TradeDetailPage'
import { TradesPage } from '../trades/TradesPage'

interface Tab {
  route: Route['name']
  label: MessageKey
  icon: LucideIcon
  /** Child routes that keep this tab highlighted. */
  matches: Route['name'][]
}

const TABS: Tab[] = [
  { route: 'today', label: 'tab.today', icon: Sun, matches: ['today'] },
  { route: 'trades', label: 'tab.trades', icon: ListChecks, matches: ['trades', 'trade'] },
  { route: 'analytics', label: 'tab.analytics', icon: ChartColumn, matches: ['analytics'] },
  { route: 'profile', label: 'tab.profile', icon: CircleUser, matches: ['profile', 'accounts', 'rules', 'review'] },
]

/**
 * Four tabs and a center "+" that opens trade entry (SPEC section 3): a bottom bar on
 * phones, a sidebar on wide screens.
 */
export function AppShell() {
  const { t } = useI18n()
  const route = useRoute()
  const { status } = useJournal()
  const { newTrade } = useSheets()
  useThemeAttribute()
  useLimitAlerts()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.name])

  const tabLink = (tab: Tab) => {
    const Icon = tab.icon
    const current = tab.matches.includes(route.name)
    return (
      <a key={tab.route} className="nav-link" href={routeHref({ name: tab.route } as Route)} aria-current={current ? 'page' : undefined}>
        <Icon size={22} aria-hidden="true" />
        <span>{t(tab.label)}</span>
      </a>
    )
  }

  const addButton = (
    <button type="button" className="nav-add" onClick={newTrade}>
      <Plus size={24} aria-hidden="true" />
      <span>{t('action.newTrade')}</span>
    </button>
  )

  return (
    <div className="shell">
      <nav className="sidebar" aria-label={t('nav.label')}>
        <div className="sidebar__brand">
          <img src="./favicon.svg" alt="" width={28} height={28} />
          <span>Mirror</span>
        </div>
        {addButton}
        {TABS.map(tabLink)}
      </nav>

      <main className="content">
        {status === 'loading' && <p className="caption loading">{t('common.loading')}</p>}
        {status === 'error' && (
          <p className="caption loading" role="alert">
            {t('common.loadError')}
          </p>
        )}
        {status === 'ready' && <Page route={route} />}
      </main>

      <nav className="tabbar" aria-label={t('nav.label')}>
        {TABS.slice(0, 2).map(tabLink)}
        {addButton}
        {TABS.slice(2).map(tabLink)}
      </nav>

      <TradeEntrySheet />
      <AccountSheet />
    </div>
  )
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'today':
      return <TodayPage />
    case 'trades':
      return <TradesPage />
    case 'trade':
      return <TradeDetailPage id={route.id} />
    case 'analytics':
      return <AnalyticsPage />
    case 'profile':
      return <ProfilePage />
    case 'accounts':
      return <AccountsPage />
    case 'rules':
      return <RulesPage />
    case 'review':
      return <WeeklyReviewPage key={route.week ?? 'current'} week={route.week} />
  }
}

/** Mirrors the theme setting onto <html data-theme>; "system" removes it so CSS follows the OS. */
function useThemeAttribute() {
  const { theme } = useSettings()
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
  }, [theme])
}
