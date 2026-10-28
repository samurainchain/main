import { Star } from 'lucide-react'
import { useStore } from '../../app/journal'
import type { Trade } from '../../core/models'
import { validRating } from '../../core/tradeTable'
import { useI18n } from '../../i18n/i18n'

const STARS = [1, 2, 3, 4, 5] as const

/**
 * The trader's 1–5 star grade of a trade, saved as soon as a star is clicked. Clicking the
 * current star clears it. Each star is a toggle button, so arrow keys stay free for moving
 * between trades in the side panel.
 */
export function StarRating({ trade, size = 16 }: { trade: Trade; size?: number }) {
  const { t } = useI18n()
  const store = useStore()
  const rating = validRating(trade.rating)

  return (
    <div className="star-rating" role="group" aria-label={rating ? t('rating.value', { value: String(rating) }) : t('rating.none')} title={t('rating.hint')}>
      {STARS.map((value) => (
        <button
          key={value}
          type="button"
          className={`star-rating__star${rating !== undefined && value <= rating ? ' star-rating__star--on' : ''}`}
          aria-label={t('rating.star', { value: String(value) })}
          aria-pressed={rating === value}
          onClick={(event) => {
            event.stopPropagation()
            void store.rateTrade(trade.id, rating === value ? undefined : value)
          }}
        >
          <Star size={size} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
