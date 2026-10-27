import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCloud } from '../../app/cloud'
import { useStore } from '../../app/journal'
import type { TradeImage } from '../../core/models'
import { useI18n } from '../../i18n/i18n'

type ImageState = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'missing' }

/**
 * A screenshot's object URL: the copy in this browser, or downloaded from the cloud and kept
 * here when this device doesn't have it yet.
 */
export function useImageUrl(id: string): ImageState {
  const store = useStore()
  const { cloud } = useCloud()
  const [state, setState] = useState<ImageState>({ status: 'loading' })

  useEffect(() => {
    let url: string | undefined
    let cancelled = false
    void (async () => {
      let blob = await store.blobs?.getBlob(id)
      if (!blob) {
        blob = await cloud.downloadImage(id).catch(() => undefined)
        if (blob) await store.blobs?.putBlob(id, blob)
      }
      if (cancelled) return
      if (!blob) return setState({ status: 'missing' })
      url = URL.createObjectURL(blob)
      setState({ status: 'ready', url })
    })()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [id, store, cloud])

  return state
}

export function StoredImage({ image, className, alt }: { image: TradeImage; className?: string; alt: string }) {
  const { t } = useI18n()
  const state = useImageUrl(image.id)
  if (state.status === 'ready') return <img className={className} src={state.url} alt={alt} width={image.width} height={image.height} />
  return (
    <div className={`${className ?? ''} image-placeholder`} style={{ aspectRatio: `${image.width} / ${image.height}` }} role="img" aria-label={alt}>
      {state.status === 'missing' && (
        <>
          <ImageOff size={20} aria-hidden="true" />
          <span className="caption">{t('images.missing')}</span>
        </>
      )}
    </div>
  )
}

/** Screenshots full width on the trade card; tapping one opens it full screen (SPEC 4.6). */
export function TradeGallery({ images }: { images: TradeImage[] }) {
  const { t } = useI18n()
  const [open, setOpen] = useState<number>()
  return (
    <>
      <div className="trade-gallery">
        {images.map((image, index) => (
          <button key={image.id} type="button" className="trade-gallery__item" aria-label={t('images.open', { index: index + 1 })} onClick={() => setOpen(index)}>
            <StoredImage image={image} className="trade-gallery__image" alt={t('images.alt', { index: index + 1 })} />
          </button>
        ))}
      </div>
      {open !== undefined && <ImageViewer images={images} index={open} onIndex={setOpen} onClose={() => setOpen(undefined)} />}
    </>
  )
}

function ImageViewer({ images, index, onIndex, onClose }: { images: TradeImage[]; index: number; onIndex: (index: number) => void; onClose: () => void }) {
  const { t } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  const image = images[index]!

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const step = (offset: number) => onIndex((index + offset + images.length) % images.length)

  return (
    <dialog
      ref={dialog}
      className="image-viewer"
      aria-label={t('images.alt', { index: index + 1 })}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') step(1)
        if (event.key === 'ArrowLeft') step(-1)
      }}
    >
      <StoredImage key={image.id} image={image} className="image-viewer__image" alt={t('images.alt', { index: index + 1 })} />
      <button type="button" className="icon-button image-viewer__close" aria-label={t('common.close')} onClick={onClose}>
        <X size={22} aria-hidden="true" />
      </button>
      {images.length > 1 && (
        <>
          <button type="button" className="icon-button image-viewer__prev" aria-label={t('images.previous')} onClick={() => step(-1)}>
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button image-viewer__next" aria-label={t('images.next')} onClick={() => step(1)}>
            <ChevronRight size={22} aria-hidden="true" />
          </button>
          <p className="image-viewer__count caption">
            {index + 1} / {images.length}
          </p>
        </>
      )}
    </dialog>
  )
}
