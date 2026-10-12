import { redo as sourceRedo, undo as sourceUndo } from '@codemirror/commands'
import { editorViewCtx, type Editor } from '@milkdown/kit/core'
import { redo, undo } from '@milkdown/kit/prose/history'
import type { Command } from '@milkdown/kit/prose/state'
import type { CommandId } from '../../../shared/commands'
import type { MenuCommandEvent } from '../../../shared/ipc-types'
import { getActiveEditor, getActiveSourceView } from '../editor/activeEditor'
import {
  insertHorizontalRule,
  toggleBlockquote,
  toggleBold,
  toggleBulletList,
  toggleCodeBlock,
  toggleHeading,
  toggleInlineCode,
  toggleItalic,
  toggleOrderedList,
  toParagraph
} from '../editor/formatting'
import { openLinkEditor } from '../editor/links'
import { normalizeWith, serializeEditor } from '../editor/markdownCore'
import { textToSave } from '../markdown/saveText'
import { documentStore } from '../state/documentStore'
import { uiStore } from '../state/uiStore'

/** Read the latest content from whichever editor is mounted into the store. */
function flushEditor(): void {
  const doc = documentStore.get()
  if (doc.mode === 'source') {
    const view = getActiveSourceView()
    if (view) documentStore.sourceChanged(view.state.doc.toString())
  } else {
    const editor = getActiveEditor()
    if (editor) documentStore.editorChanged(serializeEditor(editor))
  }
}

/** The LF text saving would write right now. */
function currentFileText(editor: Editor | null): string {
  const doc = documentStore.get()
  if (doc.mode === 'source') return doc.sourceText
  if (!editor || doc.current === null) return doc.original
  return textToSave(doc, doc.current, (md) => normalizeWith(editor, md))
}

async function save(saveAs: boolean, thenClose: boolean): Promise<void> {
  if (documentStore.get().saving) return
  // Read now rather than trusting the debounced state, which may lag the last keystroke.
  flushEditor()
  const doc = documentStore.get()

  // An unedited file that already exists on disk is never rewritten.
  if (!saveAs && doc.path && !doc.dirty) {
    if (thenClose) window.api.closeWindow()
    return
  }

  let path = doc.path
  if (saveAs || !path) {
    path = await window.api.showSaveAsDialog(doc.path)
    if (!path) return
  }

  const text = currentFileText(getActiveEditor())
  const savedMarkdown = doc.mode === 'wysiwyg' ? doc.current : null

  documentStore.saveStarted()
  const result = await window.api.saveFile(path, text, doc.format)
  if (!result.ok) {
    documentStore.saveFailed(result.error)
    window.alert(`Could not save the file.\n\n${result.error}`)
    return
  }
  documentStore.saveSucceeded(path, text, savedMarkdown)
  if (thenClose) window.api.closeWindow()
}

const editorScroller = (): HTMLElement | null => document.querySelector('.editor-scroll')

function toggleSourceMode(): void {
  const scroller = editorScroller()
  if (scroller) {
    const max = scroller.scrollHeight - scroller.clientHeight
    uiStore.set({ pendingScrollRatio: max > 0 ? scroller.scrollTop / max : 0 })
  }
  flushEditor()
  if (documentStore.get().mode === 'source') {
    documentStore.exitSource()
  } else {
    documentStore.enterSource(currentFileText(getActiveEditor()))
  }
}

/** Run a ProseMirror command in the visual editor. False if not in visual mode. */
function runVisual(command: Command): boolean {
  const editor = getActiveEditor()
  if (!editor || documentStore.get().mode !== 'wysiwyg') return false
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    command(view.state, view.dispatch, view)
    view.focus()
  })
  return true
}

function runHistory(kind: 'undo' | 'redo'): boolean {
  if (documentStore.get().mode === 'source') {
    const view = getActiveSourceView()
    if (!view) return false
    ;(kind === 'undo' ? sourceUndo : sourceRedo)(view)
    view.focus()
    return true
  }
  return runVisual(kind === 'undo' ? undo : redo)
}

function openLink(): boolean {
  const editor = getActiveEditor()
  if (!editor || documentStore.get().mode !== 'wysiwyg') return false
  return editor.action((ctx) => openLinkEditor(ctx.get(editorViewCtx)))
}

const HANDLERS: Record<CommandId, (event: MenuCommandEvent) => boolean> = {
  'file.save': (e) => (void save(false, e.thenClose ?? false), true),
  'file.saveAs': (e) => (void save(true, e.thenClose ?? false), true),
  'edit.undo': () => runHistory('undo'),
  'edit.redo': () => runHistory('redo'),
  'paragraph.heading1': () => runVisual(toggleHeading(1)),
  'paragraph.heading2': () => runVisual(toggleHeading(2)),
  'paragraph.heading3': () => runVisual(toggleHeading(3)),
  'paragraph.heading4': () => runVisual(toggleHeading(4)),
  'paragraph.heading5': () => runVisual(toggleHeading(5)),
  'paragraph.heading6': () => runVisual(toggleHeading(6)),
  'paragraph.paragraph': () => runVisual(toParagraph),
  'paragraph.quote': () => runVisual(toggleBlockquote),
  'paragraph.orderedList': () => runVisual(toggleOrderedList),
  'paragraph.bulletList': () => runVisual(toggleBulletList),
  'paragraph.codeBlock': () => runVisual(toggleCodeBlock),
  'paragraph.horizontalRule': () => runVisual(insertHorizontalRule),
  'format.bold': () => runVisual(toggleBold),
  'format.italic': () => runVisual(toggleItalic),
  'format.code': () => runVisual(toggleInlineCode),
  'format.link': () => openLink(),
  'view.sourceMode': () => (toggleSourceMode(), true),
  'view.outline': () => (uiStore.set({ sidebarOpen: !uiStore.get().sidebarOpen }), true)
}

/** Run a command. Returns false if it does not apply right now (e.g. bold in source mode). */
export function runCommand(event: MenuCommandEvent): boolean {
  return HANDLERS[event.id](event)
}
