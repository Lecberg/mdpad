import { EditorView as SourceView } from '@codemirror/view'
import { editorViewCtx } from '@milkdown/kit/core'
import { getActiveEditor, getActiveSourceView } from '../editor/activeEditor'
import { closeFind, selectOccurrence } from '../editor/find'
import { baseName, samePath } from '../lib/paths'
import { documentStore } from '../state/documentStore'
import { noticeStore } from '../state/noticeStore'
import { settingsStore } from '../state/settingsStore'
import { uiStore, type Reveal } from '../state/uiStore'
import { flushEditor, saveDocument } from './runCommand'

// Opening another file in this window (from the file tree, Quick Open or folder search),
// replacing the current document as Typora does.

/**
 * Deal with unsaved changes before the document is replaced. With autosave on, a document
 * that has a file is simply saved; otherwise the user is asked. False means "stay".
 */
async function settleCurrentDocument(): Promise<boolean> {
  flushEditor()
  const doc = documentStore.get()
  if (!doc.dirty) return true
  if (doc.path && settingsStore.get().autosave && !noticeStore.get()) return saveDocument()
  const choice = await window.api.askToSave(doc.path ? baseName(doc.path) : 'Untitled')
  if (choice === 'cancel') return false
  if (choice === 'save') return saveDocument()
  return true
}

/** Select a search match in whichever editor is showing. */
export function revealMatch(reveal: Reveal): void {
  if (documentStore.get().mode === 'source') {
    const view = getActiveSourceView()
    if (!view) return
    const line = view.state.doc.line(Math.max(1, Math.min(reveal.line, view.state.doc.lines)))
    const from = Math.min(line.from + reveal.column, line.to)
    const to = Math.min(from + reveal.query.length, line.to)
    view.dispatch({
      selection: { anchor: from, head: to },
      effects: SourceView.scrollIntoView(from, { y: 'center' })
    })
    view.focus()
    return
  }
  getActiveEditor()?.action((ctx) => {
    selectOccurrence(ctx.get(editorViewCtx), reveal.query, reveal.matchCase, reveal.occurrence)
  })
}

/** Show `path` in this window. Resolves to false if it wasn't opened (cancelled or failed). */
export async function openDocument(path: string, reveal?: Reveal): Promise<boolean> {
  if (samePath(documentStore.get().path, path)) {
    if (reveal) revealMatch(reveal)
    return true
  }
  if (!(await settleCurrentDocument())) return false
  const result = await window.api.openInWindow(path)
  if (result.kind === 'error') {
    window.alert(`Could not open the file.\n\n${result.message}`)
    return false
  }
  if (result.kind === 'elsewhere') return true
  noticeStore.dismiss()
  closeFind()
  uiStore.set({ pendingReveal: reveal ?? null })
  documentStore.load(result.file)
  return true
}
