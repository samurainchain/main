import { CalendarDays, EyeOff } from 'lucide-react'
import { updateSettings, useSettings } from '../../app/settings'
import { Button, Card } from '../../design/components'
import { useI18n } from '../../i18n/i18n'

/**
 * Investing.com's free economic calendar widget (their Webmaster Tools), as they offer it for
 * embedding with a credit line. Investing.com has no public API and doesn't allow scraping, so
 * the calendar is their own page in a frame. It sets its own cookies and ads, so it loads only
 * after the trader turns it on (SPEC section 4.3, privacy page).
 */
const WIDGET_URL =
  'https://sslecal2.investing.com?' +
  new URLSearchParams({
    columns: 'exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous',
    features: 'datepicker,timezone,timeselector,filters',
    // United States, Euro Zone, United Kingdom, Germany, Japan, Canada, Australia, China.
    countries: '5,72,4,17,35,6,25,37',
    // Medium and high importance only.
    importance: '2,3',
    calType: 'week',
    lang: '1',
  }).toString()

export function EconomicCalendar() {
  const { t } = useI18n()
  const shown = useSettings().economicCalendar === true

  return (
    <Card className="econ-calendar">
      <div className="econ-calendar__header">
        <h2 className="label">{t('calendar.title')}</h2>
        {shown && (
          <Button variant="plain" icon={<EyeOff size={16} aria-hidden="true" />} onClick={() => updateSettings({ economicCalendar: false })}>
            {t('calendar.hide')}
          </Button>
        )}
      </div>
      {shown ? (
        <>
          <iframe
            className="econ-calendar__frame"
            src={WIDGET_URL}
            title={t('calendar.frameTitle')}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          />
          <p className="caption">
            {t('calendar.creditBefore')}{' '}
            <a href="https://www.investing.com/economic-calendar/" target="_blank" rel="noopener noreferrer nofollow">
              Investing.com
            </a>
          </p>
        </>
      ) : (
        <>
          <p className="secondary-text">{t('calendar.intro')}</p>
          <p className="caption">{t('calendar.thirdParty')}</p>
          <Button icon={<CalendarDays size={18} aria-hidden="true" />} onClick={() => updateSettings({ economicCalendar: true })}>
            {t('calendar.show')}
          </Button>
        </>
      )}
    </Card>
  )
}
