import { useEffect, useRef } from 'react'
import type { SearchFileResult, SearchMatch } from '../../../shared/ipc-types'
import { openDocument } from '../commands/openDocument'
import { baseName, dirName, relativeTo } from '../lib/paths'
import { useFolder } from '../state/folderStore'
import { runSearch, updateSearch, useSearch } from '../state/searchStore'
import { useUi } from '../state/uiStore'

function Preview({ match }: { match: SearchMatch }): React.JSX.Element {
  const { preview, previewStart, previewEnd } = match
  return (
    <span className="search-preview">
      {preview.slice(0, previewStart)}
      <mark>{preview.slice(previewStart, previewEnd)}</mark>
      {preview.slice(previewEnd)}
    </span>
  )
}

interface FileResultsProps {
  file: SearchFileResult
  root: string
  query: string
  matchCase: boolean
}

function FileResults({ file, root, query, matchCase }: FileResultsProps): React.JSX.Element {
  const folder = relativeTo(root, dirName(file.path))
  return (
    <li className="search-file">
      <div className="search-file-header" title={file.path}>
        <span className="search-file-name">{baseName(file.path)}</span>
        {folder && <span className="search-file-dir">{folder}</span>}
        <span className="search-count">{file.matches.length}</span>
      </div>
      <ul>
        {file.matches.map((match) => (
          <li key={`${match.line}:${match.column}`}>
            <button
              type="button"
              className="search-match"
              title={`Line ${match.line}`}
              onClick={() =>
                void openDocument(file.path, {
                  query,
                  matchCase,
                  line: match.line,
                  column: match.column,
                  occurrence: match.occurrence
                })
              }
            >
              <Preview match={match} />
            </button>
          </li>
        ))}
      </ul>
    </li>
  )
}

export function SearchPanel(): React.JSX.Element {
  const { folder } = useFolder()
  const { searchFocusRequest } = useUi()
  const search = useSearch()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [searchFocusRequest])

  if (!folder) {
    return (
      <div className="sidebar-empty">
        <p>Open a folder to search across its files.</p>
        <button
          type="button"
          className="button"
          onClick={() => window.api.runMainCommand('file.openFolder')}
        >
          Open Folder…
        </button>
      </div>
    )
  }

  const { result, query, resultQuery } = search
  let status = ''
  if (query && result && resultQuery === query) {
    status =
      result.total === 0
        ? 'No results'
        : `${result.total}${result.truncated ? '+' : ''} result${result.total === 1 ? '' : 's'} in ${result.files.length} file${result.files.length === 1 ? '' : 's'}`
  } else if (search.searching) {
    status = 'Searching…'
  }

  return (
    <div className="search-panel">
      <div className="search-box">
        <input
          ref={input}
          className="search-input"
          type="search"
          placeholder="Search in folder"
          aria-label="Search in folder"
          data-testid="search-input"
          value={query}
          onChange={(event) => updateSearch({ query: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void runSearch()
          }}
        />
        <label className="search-option" title="Match case">
          <input
            type="checkbox"
            checked={search.matchCase}
            onChange={(event) => updateSearch({ matchCase: event.target.checked })}
          />
          Aa
        </label>
      </div>
      <div className="search-status" data-testid="search-status" aria-live="polite">
        {status}
      </div>
      {query && result && (
        <ul className="search-results" data-testid="search-results">
          {result.files.map((file) => (
            <FileResults
              key={file.path}
              file={file}
              root={folder.root}
              query={resultQuery}
              matchCase={search.matchCase}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
