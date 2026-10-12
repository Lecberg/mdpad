import { useEffect, useLayoutEffect, useRef } from 'react'

export interface MenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
}

export type MenuEntry = MenuItem | 'separator'

interface Props {
  x: number
  y: number
  items: MenuEntry[]
  onClose: () => void
}

/** A right-click menu at (x, y). Closes on Escape, an outside click, scrolling or blur. */
export function ContextMenu({ x, y, items, onClose }: Props): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu) return
    const { width, height } = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - width - 4))}px`
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - height - 4))}px`
    menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [x, y])

  useEffect(() => {
    const onPointer = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('mousedown', onPointer, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onClose)
    window.addEventListener('wheel', onClose, { passive: true })
    return () => {
      window.removeEventListener('mousedown', onPointer, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('wheel', onClose)
    }
  }, [onClose])

  const onMenuKey = (event: React.KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const buttons = [...ref.current!.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const index = buttons.indexOf(document.activeElement as HTMLElement)
    const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      data-testid="context-menu"
      style={{ left: x, top: y }}
      onKeyDown={onMenuKey}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) =>
        item === 'separator' ? (
          <div key={index} className="context-menu-separator" role="separator" />
        ) : (
          <button
            key={index}
            type="button"
            role="menuitem"
            className={item.danger ? 'context-menu-item danger' : 'context-menu-item'}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
