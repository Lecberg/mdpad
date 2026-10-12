import { editorViewCtx } from '@milkdown/kit/core'
import { redoCommand, undoCommand } from '@milkdown/kit/plugin/history'
import { callCommand } from '@milkdown/kit/utils'
import type { MenuCommandEvent } from '../../../shared/ipc-types'
import { getActiveEditor } from '../editor/activeEditor'
import { normalizeWith, serializeEditor } from '../editor/markdownCore'
import { textToSave } from '../markdown/saveText'
import { documentStore } from '../state/documentStore'

async function save(saveAs: boolean, thenClose: boolean): Promise<void> {
  const editor = getActiveEditor()
  if (!editor || documentStore.get().saving) return

  // Serialize now rather than trusting the debounced state, which may lag the last keystroke.
  const markdown = serializeEditor(editor)
  documentStore.editorChanged(markdown)
  const doc = documentStore.get()

  // Fidelity rule: an unedited file that already exists on disk is never rewritten.
  if (!saveAs && doc.path && !doc.dirty) {
    if (thenClose) window.api.closeWindow()
    return
  }

  let path = doc.path
  if (saveAs || !path) {
    path = await window.api.showSaveAsDialog(doc.path)
    if (!path) return
  }

  const text = textToSave(doc, markdown, (md) => normalizeWith(editor, md))

  documentStore.saveStarted()
  const result = await window.api.saveFile(path, text, doc.format)
  if (!result.ok) {
    documentStore.saveFailed(result.error)
    window.alert(`Could not save the file.\n\n${result.error}`)
    return
  }
  documentStore.saveSucceeded(path, text, markdown)
  if (thenClose) window.api.closeWindow()
}

function runHistory(kind: 'undo' | 'redo'): void {
  const editor = getActiveEditor()
  if (!editor) return
  editor.action(callCommand(kind === 'undo' ? undoCommand.key : redoCommand.key))
  editor.action((ctx) => ctx.get(editorViewCtx).focus())
}

export async function runCommand(event: MenuCommandEvent): Promise<void> {
  switch (event.id) {
    case 'file.save':
      return save(false, event.thenClose ?? false)
    case 'file.saveAs':
      return save(true, event.thenClose ?? false)
    case 'edit.undo':
      return runHistory('undo')
    case 'edit.redo':
      return runHistory('redo')
  }
}
