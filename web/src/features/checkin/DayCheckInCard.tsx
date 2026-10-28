import { ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { useJournal } from '../../app/journal'
import { checkInFor } from '../../core/checkins'
import { localDayKey } from '../../core/stats'
import { Button, Card } from '../../design/components'
import { useI18n } from '../../i18n/i18n'
import { CheckInSheet } from './CheckInSheet'

/** Today's check-in on the Today screen: a nudge before trading, then the end-of-day review. */
export function DayCheckInCard() {
  const { t } = useI18n()
  const { checkins } = useJournal()
  const [open, setOpen] = useState<'before' | 'after'>()
  const today = localDayKey(new Date())
  const checkIn = checkInFor(checkins, today)
  const reviewed = Boolean(checkIn && (checkIn.planKept || checkIn.review))

  const details = checkIn
    ? [
        checkIn.sleep && t('checkin.summary.sleep', { value: t(`checkin.sleep.${checkIn.sleep}`) }),
        checkIn.mood && t('checkin.summary.mood', { value: t(`emotion.${checkIn.mood}`) }),
        checkIn.planKept && t('checkin.summary.planKept', { value: t(`checkin.planKept.${checkIn.planKept}`) }),
      ].filter(Boolean)
    : []

  return (
    <>
      <Card className="checkin-card">
        <p className="caption">{t('checkin.section')}</p>
        {checkIn ? (
          <>
            {details.length > 0 && <p className="secondary-text">{details.join(' · ')}</p>}
            {checkIn.plan && <p className="checkin-card__plan">{checkIn.plan}</p>}
            <div className="action-row action-row--wrap">
              {!reviewed && (
                <Button variant="primary" onClick={() => setOpen('after')}>
                  {t('checkin.endOfDay')}
                </Button>
              )}
              <Button onClick={() => setOpen(reviewed ? 'after' : 'before')}>{t('action.edit')}</Button>
            </div>
          </>
        ) : (
          <>
            <p className="secondary-text">{t('checkin.prompt')}</p>
            <Button variant="primary" icon={<ClipboardCheck size={18} aria-hidden="true" />} onClick={() => setOpen('before')}>
              {t('checkin.start')}
            </Button>
          </>
        )}
      </Card>
      {open && <CheckInSheet date={today} existing={checkIn} focus={open} onClose={() => setOpen(undefined)} />}
    </>
  )
}
