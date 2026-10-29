import { Download, Share2 } from 'lucide-react'
import { useCallback, useId, useMemo, useState } from 'react'
import { useJournal } from '../../app/journal'
import type { Trade } from '../../core/models'
import { Button, Sheet } from '../../design/components'
import { useI18n } from '../../i18n/i18n'
import { buildShareCard, CARD_SIZE, drawShareCard } from './shareCard'
import { downloadImage, shareableFile, shareFile, useCardImage } from './shareImage'

function fileName(trade: Trade): string {
  return `tiltless-${trade.symbol.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(trade.closedAt ?? trade.openedAt).slice(0, 10)}.png`
}

/**
 * A picture of the trade to post (SPEC section 4.6): result, R, hold time, prices and rating
 * on a 1080×1080 card. The amount can be hidden, leaving R or the price move. Shares through
 * the system sheet where the browser can share files, otherwise downloads.
 */
export function ShareTradeSheet({ trade, open, onClose }: { trade: Trade; open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n()
  const { accounts } = useJournal()
  const hideId = useId()
  const [hideAmount, setHideAmount] = useState(false)
  const [message, setMessage] = useState<string>()
  const account = accounts.find((item) => item.id === trade.accountId)
  const card = useMemo(() => buildShareCard(trade, account, hideAmount, t, locale), [trade, account, hideAmount, t, locale])
  const draw = useCallback((ctx: CanvasRenderingContext2D, logo: CanvasImageSource | undefined) => drawShareCard(ctx, card, logo), [card])
  const image = useCardImage(open, CARD_SIZE, CARD_SIZE, draw)
  const file = shareableFile(image?.blob, fileName(trade))
  const canShare = Boolean(file)

  const download = () => image && downloadImage(image.url, fileName(trade))

  const share = async () => {
    if (!file) return
    setMessage(undefined)
    if (!(await shareFile(file))) setMessage(t('share.failed'))
  }

  return (
    <Sheet
      open={open}
      title={t('share.title')}
      onClose={onClose}
      footer={
        <div className="action-row action-row--wrap">
          {canShare && (
            <Button variant="primary" icon={<Share2 size={18} aria-hidden="true" />} onClick={() => void share()}>
              {t('share.share')}
            </Button>
          )}
          <Button variant={canShare ? 'secondary' : 'primary'} icon={<Download size={18} aria-hidden="true" />} disabled={!image} onClick={download}>
            {t('share.download')}
          </Button>
        </div>
      }
    >
      <div className="form-stack">
        <div className="share-preview">{image ? <img src={image.url} alt={t('share.previewAlt', { symbol: trade.symbol })} width={CARD_SIZE} height={CARD_SIZE} /> : <p className="caption">{t('share.preparing')}</p>}</div>
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
