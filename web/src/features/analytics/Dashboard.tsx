import { EyeOff, GripVertical, Minus, Plus } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { MIN_WIDTH, WIDTHS, hideWidget, moveWidget, resizeWidget, showWidget, stepWidth, type DashboardLayout, type WidgetId } from '../../core/dashboard'
import { Button } from '../../design/components'
import { useI18n } from '../../i18n/i18n'
import { WIDGETS, WidgetBody, type WidgetData } from './widgets'
import { useAccess } from '../../app/entitlement'
import { widgetUnlocked } from '../../core/entitlements'
import { ProLock } from '../billing/ProLock'

const WIDTH_LABEL: Record<number, string> = { 3: '1/4', 4: '1/3', 6: '1/2', 8: '2/3', 12: '1/1' }

const MOTION = { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
/** How close to the window's top or bottom edge a drag scrolls the page, and how fast. */
const EDGE = 64
const EDGE_STEP = 18

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * The analytics dashboard: blocks on a 12-column grid. While editing, a block moves by its
 * handle (drag, or arrow keys on the handle), changes width by its corner or − +, and hides;
 * hidden blocks come back from the list under the grid.
 */
export function Dashboard({ layout, editing, onChange, data }: { layout: DashboardLayout; editing: boolean; onChange: (layout: DashboardLayout) => void; data: WidgetData }) {
  const { t } = useI18n()
  const access = useAccess()
  const grid = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<WidgetId>()
  // While a block is dragged the blocks keep their place in the page and CSS `order` shows the
  // new arrangement: moving a node in the DOM would drop the pointer events of the drag and
  // reload the calendar's frame. The DOM catches up on drop.
  const [frozen, setFrozen] = useState<WidgetId[]>()
  // The block being dragged, and where the pointer holds it (read synchronously by the effects below).
  const drag = useRef<{ id: WidgetId; x: number; y: number; grabX: number; grabY: number }>(undefined)
  // Where every block was on screen right before a layout change, to animate from (FLIP).
  const before = useRef(new Map<string, DOMRect>())
  // A reorder waits for the previous one's slide, so blocks don't swap back and forth under the pointer.
  const settledAt = useRef(0)
  const [announcement, setAnnouncement] = useState('')
  // The latest layout for pointer handlers that outlive a render.
  const current = useRef(layout)
  current.current = layout

  const hasTrades = data.inRange.length > 0
  const visible = layout.items.filter((item) => hasTrades || !WIDGETS[item.id].needsTrades)
  const position = new Map(visible.map((item, index) => [item.id, index]))
  const rendered = frozen ? visible.slice().sort((a, b) => frozen.indexOf(a.id) - frozen.indexOf(b.id)) : visible
  const name = (id: WidgetId) => t(WIDGETS[id].title)

  const widgets = () => [...(grid.current?.querySelectorAll<HTMLElement>('[data-widget]') ?? [])]
  const widget = (id: WidgetId) => widgets().find((element) => element.dataset.widget === id)

  const update = (next: DashboardLayout) => {
    before.current = new Map(widgets().map((element) => [element.dataset.widget!, element.getBoundingClientRect()]))
    current.current = next
    onChange(next)
  }

  /** Keeps the dragged block under the pointer, wherever its slot in the grid is now. */
  const followPointer = () => {
    const held = drag.current
    const element = held && widget(held.id)
    if (!held || !element) return
    element.style.transform = 'none'
    const slot = element.getBoundingClientRect()
    element.style.transform = `translate(${held.x - held.grabX - slot.left}px, ${held.y - held.grabY - slot.top}px)`
  }

  // After a reorder or resize, slide each block from where it was to its new place, and grow or
  // shrink a resized one; a block coming back from hidden fades in.
  useLayoutEffect(() => {
    const from = before.current
    if (from.size === 0) return
    before.current = new Map()
    const animate = !reducedMotion()
    for (const element of widgets()) {
      if (element.dataset.widget === drag.current?.id) continue
      const first = from.get(element.dataset.widget!)
      for (const running of element.getAnimations()) running.cancel()
      if (!animate) continue
      const last = element.getBoundingClientRect()
      if (!first) {
        element.animate([{ opacity: 0, transform: 'scale(0.98)' }, { opacity: 1, transform: 'none' }], MOTION)
        continue
      }
      const dx = first.left - last.left
      const dy = first.top - last.top
      const resized = Math.abs(first.width - last.width) > 1
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !resized) continue
      const move = `translate(${dx}px, ${dy}px)`
      element.animate(resized ? [{ transform: move, width: `${first.width}px` }, { transform: 'none', width: `${last.width}px` }] : [{ transform: move }, { transform: 'none' }], MOTION)
    }
    followPointer()
  })

  const startMove = (event: ReactPointerEvent<HTMLButtonElement>, id: WidgetId) => {
    if (event.button !== 0) return
    event.preventDefault()
    const element = widget(id)
    if (!element) return
    const box = element.getBoundingClientRect()
    drag.current = { id, x: event.clientX, y: event.clientY, grabX: event.clientX - box.left, grabY: event.clientY - box.top }
    setDragging(id)
    setFrozen(visible.map((item) => item.id))

    const move = (moveEvent: PointerEvent) => {
      const held = drag.current
      if (!held) return
      held.x = moveEvent.clientX
      held.y = moveEvent.clientY
      if (moveEvent.clientY < EDGE) window.scrollBy(0, -EDGE_STEP)
      else if (moveEvent.clientY > window.innerHeight - EDGE) window.scrollBy(0, EDGE_STEP)
      followPointer()
      reorder()
    }
    // Takes the place of the block under the pointer. While the last slide runs it waits, then
    // looks again, so a quick drag that stops still lands where the pointer is.
    let retry: number | undefined
    const reorder = () => {
      const held = drag.current
      if (!held || retry !== undefined) return
      const wait = settledAt.current - performance.now()
      if (wait > 0) {
        retry = window.setTimeout(() => {
          retry = undefined
          reorder()
        }, wait)
        return
      }
      const over = document
        .elementsFromPoint(held.x, held.y)
        .map((element) => element.closest<HTMLElement>('[data-widget]'))
        .find((element) => element && element.dataset.widget !== id)
      const target = over?.dataset.widget as WidgetId | undefined
      if (!target) return
      const index = current.current.items.findIndex((item) => item.id === target)
      settledAt.current = performance.now() + MOTION.duration
      update(moveWidget(current.current, id, index))
    }
    const end = () => {
      window.clearTimeout(retry)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      drag.current = undefined
      setDragging(undefined)
      setFrozen(undefined)
      // Drop: glide from under the pointer into the slot.
      const dropped = widget(id)
      if (!dropped) return
      const held = dropped.getBoundingClientRect()
      dropped.style.transform = ''
      const slot = dropped.getBoundingClientRect()
      if (!reducedMotion()) dropped.animate([{ transform: `translate(${held.left - slot.left}px, ${held.top - slot.top}px)` }, { transform: 'none' }], MOTION)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const moveByKey = (event: KeyboardEvent<HTMLButtonElement>, id: WidgetId) => {
    const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const index = current.current.items.findIndex((item) => item.id === id)
    const next = moveWidget(current.current, id, index + step)
    update(next)
    const place = next.items.findIndex((item) => item.id === id) + 1
    setAnnouncement(t('dashboard.moved', { name: name(id), position: String(place), count: String(next.items.length) }))
  }

  const startResize = (event: ReactPointerEvent<HTMLSpanElement>, id: WidgetId) => {
    if (event.button !== 0 || !grid.current) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const widget = handle.closest<HTMLElement>('[data-widget]')!
    const left = widget.getBoundingClientRect().left
    const gap = parseFloat(getComputedStyle(grid.current).columnGap) || 0
    const column = (grid.current.getBoundingClientRect().width + gap) / 12
    const move = (moveEvent: PointerEvent) => update(resizeWidget(current.current, id, Math.round((moveEvent.clientX - left + gap) / column)))
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  return (
    <div className="dash">
      <div ref={grid} className={`dash-grid${editing ? ' dash-grid--editing' : ''}`}>
        {rendered.map(({ id, width }) => {
          const style = { '--span': width, '--span-md': width <= 6 ? 6 : 12, order: position.get(id) } as CSSProperties
          return (
            <section key={id} data-widget={id} className={`card dash-widget${dragging === id ? ' dash-widget--dragging' : ''}`} style={style} aria-labelledby={`widget-${id}`}>
              <header className="dash-widget__header">
                {editing && (
                  <button
                    type="button"
                    className="icon-button dash-widget__handle"
                    aria-label={t('dashboard.move', { name: name(id) })}
                    title={t('dashboard.moveHint')}
                    onPointerDown={(event) => startMove(event, id)}
                    onKeyDown={(event) => moveByKey(event, id)}
                  >
                    <GripVertical size={18} aria-hidden="true" />
                  </button>
                )}
                <h2 id={`widget-${id}`} className="dash-widget__title">
                  {name(id)}
                </h2>
                {editing && (
                  <div className="dash-widget__tools">
                    <button type="button" className="icon-button dash-widget__width-button" aria-label={t('dashboard.narrower', { name: name(id) })} disabled={width === MIN_WIDTH[id]} onClick={() => update(stepWidth(current.current, id, -1))}>
                      <Minus size={16} aria-hidden="true" />
                    </button>
                    <span className="dash-widget__width caption numeric">{WIDTH_LABEL[width]}</span>
                    <button type="button" className="icon-button dash-widget__width-button" aria-label={t('dashboard.wider', { name: name(id) })} disabled={width === WIDTHS.at(-1)} onClick={() => update(stepWidth(current.current, id, 1))}>
                      <Plus size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="icon-button" aria-label={t('dashboard.hide', { name: name(id) })} onClick={() => update(hideWidget(current.current, id))}>
                      <EyeOff size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </header>
              <div className="dash-widget__body">
                {widgetUnlocked(id, access) ? <WidgetBody id={id} data={data} /> : <ProLock feature="deepAnalytics" compact />}
              </div>
              {editing && <span className="dash-widget__resize" aria-hidden="true" title={t('dashboard.resizeHint')} onPointerDown={(event) => startResize(event, id)} />}
            </section>
          )
        })}
      </div>
      {editing && layout.hidden.length > 0 && (
        <div className="dash-hidden">
          <p className="caption">{t('dashboard.add')}</p>
          <div className="action-row action-row--wrap">
            {layout.hidden.map((id) => (
              <Button key={id} icon={<Plus size={16} aria-hidden="true" />} onClick={() => update(showWidget(current.current, id))}>
                {name(id)}
              </Button>
            ))}
          </div>
        </div>
      )}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </div>
  )
}
