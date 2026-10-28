import { useId, useState } from 'react'
import { useStore } from '../../app/journal'
import { EMOTIONS, PLAN_KEPT, SLEEP_LEVELS, type DayCheckIn } from '../../core/models'
import { Button, Field, Segmented, Sheet } from '../../design/components'
import { useI18n } from '../../i18n/i18n'
import { EMOTION_ICONS } from '../trades/TradeRow'

/** One check-in per day; the id is the date, so copies from two devices merge when syncing. */
export function checkInId(date: string): string {
  return `day-${date}`
}

/**
 * The day's check-in: sleep, mood and plan before trading, and whether the plan held after.
 * Every answer is optional; `focus` opens straight on the after-trading part.
 */
export function CheckInSheet({ date, existing, focus, onClose }: { date: string; existing?: DayCheckIn; focus: 'before' | 'after'; onClose: () => void }) {
  const { t } = useI18n()
  const store = useStore()
  const ids = { plan: useId(), review: useId() }
  const [form, setForm] = useState<DayCheckIn>(
    () =>
      existing ?? {
        id: checkInId(date),
        date,
        plan: '',
        review: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
  )
  const [saving, setSaving] = useState(false)
  const update = (patch: Partial<DayCheckIn>) => setForm((current) => ({ ...current, ...patch }))

  const save = async () => {
    setSaving(true)
    await store.saveCheckIn({ ...form, plan: form.plan.trim(), review: form.review.trim() })
    onClose()
  }

  const before = (
    <fieldset className="fieldset">
      <legend className="checkin__part">{t('checkin.before')}</legend>
      <div className="fieldset">
        <span className="field__label">{t('checkin.sleep')}</span>
        <Segmented
          label={t('checkin.sleep')}
          value={form.sleep ?? ('' as never)}
          options={SLEEP_LEVELS.map((value) => ({ value, label: t(`checkin.sleep.${value}`) }))}
          onChange={(sleep) => update({ sleep })}
        />
      </div>
      <fieldset className="fieldset">
        <legend className="field__label">{t('checkin.mood')}</legend>
        <div className="emotion-picker">
          {EMOTIONS.map((emotion) => {
            const Icon = EMOTION_ICONS[emotion]
            const selected = form.mood === emotion
            return (
              <button key={emotion} type="button" className="emotion-picker__option" aria-pressed={selected} onClick={() => update({ mood: selected ? undefined : emotion })}>
                <Icon size={22} aria-hidden="true" />
                <span>{t(`emotion.${emotion}`)}</span>
              </button>
            )
          })}
        </div>
      </fieldset>
      <Field label={t('checkin.plan')} hint={t('checkin.planHint')} htmlFor={ids.plan}>
        <textarea id={ids.plan} className="input" rows={3} value={form.plan} onChange={(event) => update({ plan: event.target.value })} />
      </Field>
    </fieldset>
  )

  const after = (
    <fieldset className="fieldset">
      <legend className="checkin__part">{t('checkin.after')}</legend>
      <div className="fieldset">
        <span className="field__label">{t('checkin.planKept')}</span>
        <Segmented
          label={t('checkin.planKept')}
          value={form.planKept ?? ('' as never)}
          options={PLAN_KEPT.map((value) => ({ value, label: t(`checkin.planKept.${value}`) }))}
          onChange={(planKept) => update({ planKept })}
        />
      </div>
      <Field label={t('checkin.review')} htmlFor={ids.review}>
        <textarea id={ids.review} className="input" rows={3} value={form.review} onChange={(event) => update({ review: event.target.value })} />
      </Field>
    </fieldset>
  )

  return (
    <Sheet
      open
      title={t('checkin.title')}
      onClose={onClose}
      footer={
        <Button variant="primary" block disabled={saving} onClick={() => void save()}>
          {t('action.save')}
        </Button>
      }
    >
      <div className="form-stack">
        {focus === 'after' ? (
          <>
            {after}
            {before}
          </>
        ) : (
          <>
            {before}
            {after}
          </>
        )}
      </div>
    </Sheet>
  )
}
