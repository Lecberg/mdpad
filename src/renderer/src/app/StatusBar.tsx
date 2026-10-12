import { useDocInfo } from '../state/docInfoStore'
import type { DocState } from '../state/documentStore'
import { useUi } from '../state/uiStore'

function saveState(doc: DocState): string {
  if (doc.saving) return 'Saving…'
  if (doc.error) return 'Save failed'
  // An edit not yet read back from the editor (changePending) counts as unsaved too.
  if (doc.dirty || doc.changePending) return 'Unsaved changes'
  return doc.path ? 'Saved' : 'New document'
}

const plural = (n: number, word: string): string =>
  `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`

export function StatusBar({ doc }: { doc: DocState }): React.JSX.Element {
  const { words, characters } = useDocInfo()
  const { statusMessage } = useUi()
  return (
    <footer className="status-bar" data-testid="status-bar">
      <span className="status-path" title={doc.path ?? undefined}>
        {doc.path ?? 'Untitled'}
      </span>
      {doc.mode === 'wysiwyg' && doc.normalizes && (
        <span
          className="status-note"
          data-testid="normalize-note"
          title="Some syntax in this file is written differently by the editor (for example setext headings or * bullets). Untouched lines are kept as-is; only blocks you edit are rewritten."
        >
          Edited blocks may be reformatted
        </span>
      )}
      {statusMessage && (
        <span className="status-message" data-testid="status-message" role="status">
          {statusMessage}
        </span>
      )}
      {doc.mode === 'source' && (
        <span className="status-mode" data-testid="mode">
          Source
        </span>
      )}
      <span
        className="status-count"
        data-testid="word-count"
        title={plural(characters, 'character')}
      >
        {plural(words, 'word')}
      </span>
      <span className="status-save" data-testid="save-state">
        {saveState(doc)}
      </span>
    </footer>
  )
}
