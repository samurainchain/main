import { ChevronLeft, ChevronRight, Download, Share2 } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useJournal, useMistakeName } from '../../app/journal'
import { useWeekStart } from '../../app/settings'
import { buildRecap, RECAP_SPANS, shiftAnchor, type RecapSpan } from '../../core/recap'
import { closedTrades, localDayKey } from '../../core/stats'
import { Button, Segmented, Sheet } from '../../design/components'
import { useI18n } from '../../i18n/i18n'
import { useVisibleTrades } from '../trades/tradeQueries'
import { buildRecapCard, drawRecapCard, RECAP_HEIGHT, RECAP_WIDTH } from './recapCard'
import { downloadImage, shareableFile, shareFile, useCardImage } from './shareImage'

/**
 * A picture of a day's, week's or month's results to post (SPEC section 4.6): PnL, the day or
 * daily bars, win rate, best and worst trade and the mistake that cost most. Earlier periods
 * are a tap away; the amount can be hidden, leaving R and ratios.
 */
export function RecapShareSheet({ open, onClose, initialSpan }: { open: boolean; onClose: () => void; initialSpan: RecapSpan }) {
  const { t, tp, locale } = useI18n()
  const { mistakes } = useJournal()
  const { trades, currency } = useVisibleTrades()
  const weekStart = useWeekStart()
  const mistakeName = useMistakeName()
  const hideId = useId()
  const [span, setSpan] = useState<RecapSpan>(initialSpan)
  const [anchor, setAnchor] = useState(() => new Date())
  const [hideAmount, setHideAmount] = useState(false)
  const [message, setMessage] = useState<string>()

  // Each opening starts from the current period of the span it was opened for.
  useEffect(() => {
    if (!open) return
    setSpan(initialSpan)
    setAnchor(new Date())
    setMessage(undefined)
  }, [open, initialSpan])

  const closed = useMemo(() => closedTrades(trades), [trades])
  const recap = useMemo(() => buildRecap(closed, mistakes, span, anchor, weekStart), [closed, mistakes, span, anchor, weekStart])
  const card = useMemo(() => buildRecapCard(recap, currency, hideAmount, t, tp, locale, mistakeName), [recap, currency, hideAmount, t, tp, locale, mistakeName])
  const draw = useCallback((ctx: CanvasRenderingContext2D, logo: CanvasImageSource | undefined) => drawRecapCard(ctx, card, logo), [card])
  const image = useCardImage(open, RECAP_WIDTH, RECAP_HEIGHT, draw)
  const isCurrent = recap.range.end > new Date()
  const name = `tiltless-${span}-${localDayKey(recap.range.start)}.png`
  const file = shareableFile(image?.blob, name)

  const share = async () => {
    if (!file) return
    setMessage(undefined)
    if (!(await shareFile(file))) setMessage(t('share.failed'))
  }

  return (
    <Sheet
      open={open}
      title={t('recap.title')}
      onClose={onClose}
      footer={
        <div className="action-row action-row--wrap">
          {file && (
            <Button variant="primary" icon={<Share2 size={18} aria-hidden="true" />} onClick={() => void share()}>
              {t('share.share')}
            </Button>
          )}
          <Button variant={file ? 'secondary' : 'primary'} icon={<Download size={18} aria-hidden="true" />} disabled={!image} onClick={() => image && downloadImage(image.url, name)}>
            {t('share.download')}
          </Button>
        </div>
      }
    >
      <div className="form-stack">
        <Segmented label={t('recap.span')} value={span} onChange={setSpan} options={RECAP_SPANS.map((value) => ({ value, label: t(`recap.span.${value}`) }))} />
        <div className="recap-nav">
          <button type="button" className="icon-button" aria-label={t('recap.previous')} onClick={() => setAnchor((current) => shiftAnchor(span, current, -1))}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <p className="recap-nav__period" aria-live="polite">
            {card.period}
          </p>
          <button type="button" className="icon-button" aria-label={t('recap.next')} disabled={isCurrent} onClick={() => setAnchor((current) => shiftAnchor(span, current, 1))}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="recap-preview">
          {image ? <img src={image.url} alt={t('recap.previewAlt', { period: card.period })} width={RECAP_WIDTH} height={RECAP_HEIGHT} /> : <p className="caption">{t('share.preparing')}</p>}
        </div>
        <label className="checkbox-row" htmlFor={hideId}>
          <input id={hideId} type="checkbox" checked={hideAmount} onChange={(event) => setHideAmount(event.target.checked)} />
          <span>{t('share.hideAmount')}</span>
        </label>
        {message && (
          <p className="caption" role="status">
            {message}
          </p>
        )}
      </div>
    </Sheet>
  )
}
