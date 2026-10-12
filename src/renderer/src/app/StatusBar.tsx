import type { DocState } from '../state/documentStore'

function saveState(doc: DocState): string {
  if (doc.saving) return 'Saving…'
  if (doc.error) return 'Save failed'
  if (doc.dirty) return 'Unsaved changes'
  return doc.path ? 'Saved' : 'New document'
}

export function StatusBar({ doc }: { doc: DocState }): React.JSX.Element {
  return (
    <footer className="status-bar" data-testid="status-bar">
      <span className="status-path" title={doc.path ?? undefined}>
        {doc.path ?? 'Untitled'}
      </span>
      {doc.normalizes && (
        <span
          className="status-note"
          data-testid="normalize-note"
          title="Some syntax in this file is written differently by the editor (for example setext headings or * bullets). Untouched lines are kept as-is; only blocks you edit are rewritten."
        >
          Edited blocks may be reformatted
        </span>
      )}
      <span className="status-save" data-testid="save-state">
        {saveState(doc)}
      </span>
    </footer>
  )
}
