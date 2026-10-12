import { useEffect, useRef } from 'react'

import {
  closeFind,
  findNextMatch,
  findPreviousMatch,
  replaceAllMatches,
  replaceMatch,
  updateFind,
  useFind
} from '../editor/find'

const Icon = ({ d }: { d: string }): React.JSX.Element => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
)

export function FindBar(): React.JSX.Element | null {
  const find = useFind()
  const queryInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!find.open) return
    queryInput.current?.focus()
    queryInput.current?.select()
  }, [find.open, find.focusRequest])

  // Escape closes the bar wherever focus is (e.g. after Replace All disables the button
  // that had focus), unless another popup is handling it.
  useEffect(() => {
    if (!find.open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) closeFind()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [find.open])

  if (!find.open) return null

  const status = find.invalid
    ? 'Invalid pattern'
    : !find.query
      ? ''
      : find.total === 0
        ? 'No results'
        : find.current > 0
          ? `${find.current} of ${find.total}`
          : `${find.total} found`

  return (
    <div className="find-bar" role="search" data-testid="find-bar">
      <div className="find-row">
        <input
          ref={queryInput}
          className="find-input"
          aria-label="Find"
          placeholder="Find"
          data-testid="find-input"
          value={find.query}
          onChange={(event) => updateFind({ query: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (event.shiftKey) findPreviousMatch()
              else findNextMatch()
            }
          }}
        />
        <span className="find-status" data-testid="find-status" aria-live="polite">
          {status}
        </span>
        <button
          type="button"
          title="Previous match (Shift+Enter)"
          aria-label="Previous match"
          onClick={findPreviousMatch}
        >
          <Icon d="M4 10l4-4 4 4" />
        </button>
        <button
          type="button"
          title="Next match (Enter)"
          aria-label="Next match"
          onClick={findNextMatch}
        >
          <Icon d="M4 6l4 4 4-4" />
        </button>
        <label className="find-toggle" title="Match case">
          <input
            type="checkbox"
            checked={find.caseSensitive}
            onChange={(event) => updateFind({ caseSensitive: event.target.checked })}
          />
          Aa
        </label>
        <label className="find-toggle" title="Regular expression">
          <input
            type="checkbox"
            checked={find.regexp}
            onChange={(event) => updateFind({ regexp: event.target.checked })}
          />
          .*
        </label>
        <button
          type="button"
          title={find.showReplace ? 'Hide replace' : 'Show replace (Ctrl+H)'}
          aria-expanded={find.showReplace}
          onClick={() => updateFind({ showReplace: !find.showReplace })}
        >
          Replace…
        </button>
        <button type="button" title="Close (Esc)" aria-label="Close find" onClick={closeFind}>
          <Icon d="M4 4l8 8M12 4l-8 8" />
        </button>
      </div>
      {find.showReplace && (
        <div className="find-row">
          <input
            className="find-input"
            aria-label="Replace with"
            placeholder="Replace with"
            data-testid="replace-input"
            value={find.replacement}
            onChange={(event) => updateFind({ replacement: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                replaceMatch()
              }
            }}
          />
          <button type="button" onClick={replaceMatch} disabled={find.total === 0}>
            Replace
          </button>
          <button
            type="button"
            data-testid="replace-all"
            onClick={replaceAllMatches}
            disabled={find.total === 0}
          >
            Replace All
          </button>
        </div>
      )}
    </div>
  )
}
