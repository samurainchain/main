import { Download, Share2 } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useJournal } from '../../app/journal'
import type { Trade } from '../../core/models'
import { Button, Sheet } from '../../design/components'
import { useI18n } from '../../i18n/i18n'
import { buildShareCard, CARD_SIZE, drawShareCard } from './shareCard'

function loadLogo(): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(undefined)
    image.src = './favicon.svg'
  })
}

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
  const [image, setImage] = useState<{ blob: Blob; url: string }>()
  const [message, setMessage] = useState<string>()
  const account = accounts.find((item) => item.id === trade.accountId)
  const card = useMemo(() => buildShareCard(trade, account, hideAmount, t, locale), [trade, account, hideAmount, t, locale])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let url: string | undefined
    void (async () => {
      const logo = await loadLogo()
      const canvas = document.createElement('canvas')
      canvas.width = CARD_SIZE
      canvas.height = CARD_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx || cancelled) return
      await document.fonts?.ready
      drawShareCard(ctx, card, logo)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob || cancelled) return
      url = URL.createObjectURL(blob)
      setImage({ blob, url })
    })()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [open, card])

  const file = image ? new File([image.blob], fileName(trade), { type: 'image/png' }) : undefined
  const canShare = Boolean(file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }))

  const download = () => {
    if (!image) return
    const link = document.createElement('a')
    link.href = image.url
    link.download = fileName(trade)
    link.click()
  }

  const share = async () => {
    if (!file) return
    setMessage(undefined)
    try {
      await navigator.share({ files: [file] })
    } catch (error) {
      // Closing the share sheet isn't a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage(t('share.failed'))
    }
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
