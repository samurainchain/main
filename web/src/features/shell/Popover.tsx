import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/**
 * A button in the top bar that opens a small panel under it. Escape or a click outside closes
 * it and puts focus back on the button.
 */
export function Popover({
  label,
  trigger,
  className,
  onClose,
  children,
}: {
  /** The button's accessible name, also its tooltip and the panel's name. */
  label: string
  trigger: ReactNode
  className?: string
  onClose?: () => void
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const closing = useRef(onClose)
  closing.current = onClose

  const close = (focusButton = true) => {
    setOpen(false)
    closing.current?.()
    if (focusButton) button.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLElement>('.popover__panel button, .popover__panel a, .popover__panel input, .popover__panel textarea')?.focus()
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div ref={root} className={`popover${className ? ` ${className}` : ''}`}>
      <button
        ref={button}
        type="button"
        className="icon-button app-bar__button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {trigger}
      </button>
      {open && (
        <div id={panelId} className="popover__panel" role="dialog" aria-label={label}>
          {children(() => close())}
        </div>
      )}
    </div>
  )
}
