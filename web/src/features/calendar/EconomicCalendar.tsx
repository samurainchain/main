import { CalendarDays, EyeOff } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { updateSettings, useSettings } from '../../app/settings'
import { Button } from '../../design/components'
import { useI18n, type Locale } from '../../i18n/i18n'

/**
 * Investing.com's free economic calendar widget (their Webmaster Tools), as they offer it for
 * embedding with a credit line. Investing.com has no public API and doesn't allow scraping, so
 * the calendar is their own page in a frame. It sets its own cookies and ads, so it loads only
 * after the trader turns it on (SPEC section 4.7, privacy page).
 */
// Settings from the widget builder at investing.com/webmaster-tools/economic-calendar.
const WIDGET_BASE = {
  columns: 'exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous',
  category: '_employment,_economicActivity,_inflation,_credit,_centralBanks,_confidenceIndex,_balance,_Bonds',
  // Medium and high importance only.
  importance: '2,3',
  features: 'datepicker,timezone,timeselector,filters',
  countries: '25,6,37,72,22,17,39,35,43,56,36,110,11,26,4,5',
  calType: 'week',
  // Eastern Time, where most of the audience trades; the widget lets each viewer change it.
  timeZone: '8',
}

/**
 * The widget's colors, from the design tokens (it can't read CSS variables). Its body is always
 * white: "background" only paints the date rows, so the text stays dark in both themes and the
 * date rows take the theme's surface.
 */
const WIDGET_COLORS = {
  dark: { ecoDayBackground: '#171717', defaultFont: '#171717', innerBorderColor: '#e4e4e4', borderColor: '#2e2e2e', ecoDayFontColor: '#ededed' },
  light: { ecoDayBackground: '#f4f4f4', defaultFont: '#171717', innerBorderColor: '#e4e4e4', borderColor: '#e4e4e4', ecoDayFontColor: '#171717' },
}

/** Investing.com's language ids; languages without a known id fall back to English. */
const WIDGET_LANGUAGES: Partial<Record<Locale, string>> = { en: '1' }

export function widgetUrl(theme: 'dark' | 'light', locale: Locale): string {
  const params = new URLSearchParams({ ...WIDGET_COLORS[theme], ...WIDGET_BASE, lang: WIDGET_LANGUAGES[locale] ?? '1' })
  return `https://sslecal2.investing.com?${params.toString()}`
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribeToScheme(listener: () => void): () => void {
  const query = window.matchMedia?.(DARK_QUERY)
  query?.addEventListener('change', listener)
  return () => query?.removeEventListener('change', listener)
}

/** The theme on screen: the setting, or the system's when it follows the system. */
function useResolvedTheme(): 'dark' | 'light' {
  const { theme } = useSettings()
  const systemDark = useSyncExternalStore(subscribeToScheme, () => window.matchMedia?.(DARK_QUERY).matches ?? true)
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
}

/** The calendar's body for its dashboard block: the opt-in, or the widget with its credit line. */
export function EconomicCalendar() {
  const { t, locale } = useI18n()
  const shown = useSettings().economicCalendar === true
  const theme = useResolvedTheme()

  if (!shown) {
    return (
      <div className="econ-calendar">
        <p className="secondary-text">{t('calendar.intro')}</p>
        <p className="caption">{t('calendar.thirdParty')}</p>
        <Button icon={<CalendarDays size={18} aria-hidden="true" />} onClick={() => updateSettings({ economicCalendar: true })}>
          {t('calendar.show')}
        </Button>
      </div>
    )
  }
  return (
    <div className="econ-calendar">
      <iframe
        className="econ-calendar__frame"
        src={widgetUrl(theme, locale)}
        title={t('calendar.frameTitle')}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
      />
      <div className="econ-calendar__footer">
        <p className="caption">
          {t('calendar.creditBefore')}{' '}
          <a href="https://www.investing.com/economic-calendar/" target="_blank" rel="noopener noreferrer nofollow">
            Investing.com
          </a>
        </p>
        <Button variant="plain" icon={<EyeOff size={16} aria-hidden="true" />} onClick={() => updateSettings({ economicCalendar: false })}>
          {t('calendar.hide')}
        </Button>
      </div>
    </div>
  )
}
