import { useEffect, useMemo, useRef, useState } from 'react'
import { openDocument } from '../commands/openDocument'
import { focusEditor } from '../editor/activeEditor'
import { rankFuzzy } from '../lib/fuzzy'
import { isInside, relativeTo, samePath } from '../lib/paths'
import { allFiles, useFolder } from '../state/folderStore'
import { uiStore, useUi } from '../state/uiStore'

const MAX_RESULTS = 60

interface Candidate {
  path: string
  /** What is shown and matched: the path relative to the folder, or the full path. */
  label: string
  recent: boolean
}

function Highlighted({
  text,
  indices,
  offset
}: {
  text: string
  indices: Set<number>
  offset: number
}): React.JSX.Element {
  return (
    <>
      {[...text].map((ch, i) =>
        indices.has(i + offset) ? <mark key={i}>{ch}</mark> : <span key={i}>{ch}</span>
      )}
    </>
  )
}

function close(): void {
  uiStore.set({ quickOpenOpen: false })
  focusEditor()
}

function QuickOpenDialog(): React.JSX.Element {
  const { folder } = useFolder()
  const [recent, setRecent] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.getRecent().then((r) => {
      if (!cancelled) setRecent(r.files)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const candidates = useMemo((): Candidate[] => {
    const root = folder?.root ?? null
    const files = folder ? allFiles(folder.children) : []
    const recentFirst = recent.map((path) => ({
      path,
      label: root ? relativeTo(root, path) : path,
      recent: true
    }))
    const rest = files
      .filter((path) => !recent.some((r) => samePath(r, path)))
      .map((path) => ({ path, label: relativeTo(root!, path), recent: false }))
    // Recent files outside the folder come after the folder's own files when searching.
    const inFolder = (c: Candidate): boolean => !!root && isInside(root, c.path)
    return [...recentFirst.filter(inFolder), ...rest, ...recentFirst.filter((c) => !inFolder(c))]
  }, [folder, recent])

  const results = useMemo(
    () => rankFuzzy(candidates, query, (c) => c.label).slice(0, MAX_RESULTS),
    [candidates, query]
  )
  const current = Math.min(selected, Math.max(0, results.length - 1))

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const open = (candidate: Candidate | undefined): void => {
    if (!candidate) return
    uiStore.set({ quickOpenOpen: false })
    void openDocument(candidate.path).then(focusEditor)
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setSelected((current + step + results.length) % Math.max(1, results.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      open(results[current]?.item)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }

  return (
    <div
      className="modal-backdrop quick-open-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="quick-open"
        role="dialog"
        aria-modal="true"
        aria-label="Quick Open"
        data-testid="quick-open"
      >
        <input
          autoFocus
          className="quick-open-input"
          placeholder={folder ? 'Search files by name' : 'Search recent files'}
          aria-label="File name"
          role="combobox"
          aria-expanded="true"
          aria-controls="quick-open-list"
          aria-activedescendant={results.length ? `quick-open-item-${current}` : undefined}
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelected(0)
          }}
          onKeyDown={onKeyDown}
        />
        <ul
          ref={list}
          id="quick-open-list"
          className="quick-open-list"
          role="listbox"
          aria-label="Files"
        >
          {results.map(({ item, match }, index) => {
            const indices = new Set(match.indices)
            const slash = item.label.search(/[\\/][^\\/]*$/)
            const nameStart = slash + 1
            return (
              <li
                key={item.path}
                id={`quick-open-item-${index}`}
                role="option"
                aria-selected={index === current}
                className="quick-open-item"
                title={item.path}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => open(item)}
                onMouseMove={() => index !== current && setSelected(index)}
              >
                <span className="quick-open-name">
                  <Highlighted
                    text={item.label.slice(nameStart)}
                    indices={indices}
                    offset={nameStart}
                  />
                </span>
                {slash > 0 && (
                  <span className="quick-open-dir">
                    <Highlighted text={item.label.slice(0, slash)} indices={indices} offset={0} />
                  </span>
                )}
                {item.recent && <span className="quick-open-tag">recent</span>}
              </li>
            )
          })}
          {results.length === 0 && (
            <li className="quick-open-empty" role="presentation">
              {candidates.length === 0
                ? 'Open a folder (File › Open Folder…) to find files here.'
                : 'No matching files'}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

export function QuickOpen(): React.JSX.Element | null {
  const { quickOpenOpen } = useUi()
  return quickOpenOpen ? <QuickOpenDialog /> : null
}
