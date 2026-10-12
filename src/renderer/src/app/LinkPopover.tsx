import { useEffect, useRef, useState } from 'react'
import { applyLink, closeLinkEditor, useLinkEditor, type LinkEditorState } from '../editor/links'

const POPOVER_WIDTH = 360

function LinkForm({ link }: { link: LinkEditorState }): React.JSX.Element {
  const [value, setValue] = useState(link.href)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  // The popover is positioned in viewport coordinates, so close it if the page scrolls.
  useEffect(() => {
    const scroller = document.querySelector('.editor-scroll')
    const close = (): void => closeLinkEditor(false)
    scroller?.addEventListener('scroll', close, { once: true })
    return () => scroller?.removeEventListener('scroll', close)
  }, [])

  const left = Math.max(8, Math.min(link.left, window.innerWidth - POPOVER_WIDTH - 8))
  return (
    <div
      className="link-popover"
      style={{ top: link.top, left, width: POPOVER_WIDTH }}
      role="dialog"
      aria-label="Edit link"
    >
      <input
        ref={input}
        className="link-popover-input"
        data-testid="link-input"
        aria-label="Link URL"
        placeholder="https://… or ./other-note.md"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            applyLink(value)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            closeLinkEditor()
          }
        }}
        onBlur={() => closeLinkEditor(false)}
      />
      <span className="link-popover-hint">Enter to apply · empty removes · Esc cancels</span>
    </div>
  )
}

export function LinkPopover(): React.JSX.Element | null {
  const link = useLinkEditor()
  if (!link.open) return null
  // Remount per link so the form starts from that link's URL.
  return <LinkForm key={`${link.from}-${link.to}-${link.href}`} link={link} />
}
