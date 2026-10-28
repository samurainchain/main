import { EyeOff, GripVertical, Minus, Plus } from 'lucide-react'
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { MIN_WIDTH, WIDTHS, hideWidget, moveWidget, resizeWidget, showWidget, stepWidth, type DashboardLayout, type WidgetId } from '../../core/dashboard'
import { Button } from '../../design/components'
import { useI18n } from '../../i18n/i18n'
import { WIDGETS, WidgetBody, type WidgetData } from './widgets'

const WIDTH_LABEL: Record<number, string> = { 3: '1/4', 4: '1/3', 6: '1/2', 8: '2/3', 12: '1/1' }

/**
 * The analytics dashboard: blocks on a 12-column grid. While editing, a block moves by its
 * handle (drag, or arrow keys on the handle), changes width by its corner or − +, and hides;
 * hidden blocks come back from the list under the grid.
 */
export function Dashboard({ layout, editing, onChange, data }: { layout: DashboardLayout; editing: boolean; onChange: (layout: DashboardLayout) => void; data: WidgetData }) {
  const { t } = useI18n()
  const grid = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<WidgetId>()
  const [announcement, setAnnouncement] = useState('')
  // The latest layout for pointer handlers that outlive a render.
  const current = useRef(layout)
  current.current = layout

  const hasTrades = data.inRange.length > 0
  const visible = layout.items.filter((item) => hasTrades || !WIDGETS[item.id].needsTrades)
  const name = (id: WidgetId) => t(WIDGETS[id].title)

  const update = (next: DashboardLayout) => {
    current.current = next
    onChange(next)
  }

  const startMove = (event: ReactPointerEvent<HTMLButtonElement>, id: WidgetId) => {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    setDragging(id)
    const move = (moveEvent: PointerEvent) => {
      const over = document
        .elementsFromPoint(moveEvent.clientX, moveEvent.clientY)
        .map((element) => element.closest<HTMLElement>('[data-widget]'))
        .find((element) => element && element.dataset.widget !== id)
      const target = over?.dataset.widget as WidgetId | undefined
      if (!target) return
      const index = current.current.items.findIndex((item) => item.id === target)
      update(moveWidget(current.current, id, index))
    }
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      setDragging(undefined)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  const moveByKey = (event: KeyboardEvent<HTMLButtonElement>, id: WidgetId) => {
    const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const index = current.current.items.findIndex((item) => item.id === id)
    const next = moveWidget(current.current, id, index + step)
    update(next)
    const position = next.items.findIndex((item) => item.id === id) + 1
    setAnnouncement(t('dashboard.moved', { name: name(id), position: String(position), count: String(next.items.length) }))
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
        {visible.map(({ id, width }) => {
          const style = { '--span': width, '--span-md': width <= 6 ? 6 : 12 } as CSSProperties
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
                <WidgetBody id={id} data={data} />
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
