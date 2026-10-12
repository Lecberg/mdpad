import { redo as sourceRedo, undo as sourceUndo } from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'
import { editorViewCtx, type Editor } from '@milkdown/kit/core'
import { insertTableCommand } from '@milkdown/kit/preset/gfm'
import { redo, undo } from '@milkdown/kit/prose/history'
import { TextSelection, type Command } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { callCommand } from '@milkdown/kit/utils'
import { isMainCommand, type CommandId } from '../../../shared/commands'
import type { MenuCommandEvent } from '../../../shared/ipc-types'
import { getActiveEditor, getActiveSourceView } from '../editor/activeEditor'
import { closeFind, openFind } from '../editor/find'
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
  toggleStrikethrough,
  toParagraph
} from '../editor/formatting'
import { openLinkEditor } from '../editor/links'
import { normalizeWith, serializeEditor } from '../editor/markdownCore'
import { textToSave } from '../markdown/saveText'
import { documentStore } from '../state/documentStore'
import { toggleSidebarTab, uiStore } from '../state/uiStore'

/** Read the latest content from whichever editor is mounted into the store. */
export function flushEditor(): void {
  const doc = documentStore.get()
  if (doc.mode === 'source') {
    const view = getActiveSourceView()
    if (view) documentStore.sourceChanged(view.state.doc.toString())
  } else {
    const editor = getActiveEditor()
    if (editor) documentStore.editorChanged(serializeEditor(editor))
  }
}

function fileTextFor(editor: Editor | null): string {
  const doc = documentStore.get()
  if (doc.mode === 'source') return doc.sourceText
  if (!editor || doc.current === null) return doc.original
  return textToSave(doc, doc.current, (md) => normalizeWith(editor, md))
}

/** The LF text saving would write right now (after reading the latest editor content). */
export function currentFileText(): string {
  flushEditor()
  return fileTextFor(getActiveEditor())
}

export interface SaveOptions {
  saveAs?: boolean
  /** Close the window after a successful save (the close prompt's "Save"). */
  thenClose?: boolean
  /** Autosave: report failures only in the status bar, not with a dialog. */
  silent?: boolean
}

/** Save the document. Resolves to true if it is saved afterwards. */
export async function saveDocument(options: SaveOptions = {}): Promise<boolean> {
  const { saveAs = false, thenClose = false, silent = false } = options
  if (documentStore.get().saving) return false
  // Read now rather than trusting the debounced state, which may lag the last keystroke.
  flushEditor()
  const doc = documentStore.get()

  // An unedited file that already exists on disk is never rewritten.
  if (!saveAs && doc.path && !doc.dirty) {
    if (thenClose) window.api.closeWindow()
    return true
  }

  let path = doc.path
  if (saveAs || !path) {
    path = await window.api.showSaveAsDialog(doc.path)
    if (!path) return false
  }

  flushEditor() // the dialog may have been open a while
  const latest = documentStore.get()
  const text = fileTextFor(getActiveEditor())
  const savedMarkdown = latest.mode === 'wysiwyg' ? latest.current : null

  documentStore.saveStarted()
  const result = await window.api.saveFile(path, text, latest.format)
  if (!result.ok) {
    documentStore.saveFailed(result.error)
    if (!silent) window.alert(`Could not save the file.\n\n${result.error}`)
    return false
  }
  documentStore.saveSucceeded(path, text, savedMarkdown)
  if (thenClose) window.api.closeWindow()
  return true
}

const editorScroller = (): HTMLElement | null => document.querySelector('.editor-scroll')

function toggleSourceMode(): void {
  const scroller = editorScroller()
  if (scroller) {
    const max = scroller.scrollHeight - scroller.clientHeight
    uiStore.set({ pendingScrollRatio: max > 0 ? scroller.scrollTop / max : 0 })
  }
  closeFind()
  flushEditor()
  if (documentStore.get().mode === 'source') {
    documentStore.exitSource()
  } else {
    documentStore.enterSource(fileTextFor(getActiveEditor()))
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

function withVisualView(fn: (view: EditorView) => void): boolean {
  const editor = getActiveEditor()
  if (!editor || documentStore.get().mode !== 'wysiwyg') return false
  editor.action((ctx) => fn(ctx.get(editorViewCtx)))
  return true
}

function find(withReplace: boolean): boolean {
  if (documentStore.get().mode === 'source') {
    const view = getActiveSourceView()
    return view ? openSearchPanel(view) || true : false
  }
  return withVisualView((view) => openFind(view, withReplace))
}

function insertTable(): boolean {
  const editor = getActiveEditor()
  if (!editor || documentStore.get().mode !== 'wysiwyg') return false
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const before = view.state.selection.from
    callCommand(insertTableCommand.key, { row: 3, col: 3 })(ctx)
    // Put the caret in the new table's first cell, as Typora does.
    let tablePos = -1
    view.state.doc.descendants((node, pos) => {
      if (tablePos >= 0) return false
      if (node.type.name === 'table' && pos + node.nodeSize > before) tablePos = pos
      return tablePos < 0
    })
    if (tablePos >= 0) {
      const { doc, tr } = view.state
      // Milkdown defaults new cells to left alignment, which writes ":---"; a plain new
      // table (like Typora's) has no alignment markers.
      doc.nodeAt(tablePos)!.descendants((cell, offset) => {
        if (cell.attrs.alignment !== undefined) {
          tr.setNodeMarkup(tablePos + 1 + offset, undefined, { ...cell.attrs, alignment: null })
        }
        return cell.type.name.endsWith('_row') // table_header_row, table_row
      })
      tr.setSelection(TextSelection.near(tr.doc.resolve(tablePos + 1)))
      view.dispatch(tr.scrollIntoView())
    }
    view.focus()
  })
  return true
}

/** Show the folder search panel and focus its input. */
function openSearch(): boolean {
  const { searchFocusRequest } = uiStore.get()
  uiStore.set({
    sidebarOpen: true,
    sidebarTab: 'search',
    searchFocusRequest: searchFocusRequest + 1
  })
  return true
}

const forwardToMain = (event: MenuCommandEvent): boolean => {
  if (!isMainCommand(event.id)) return false
  window.api.runMainCommand(event.id)
  return true
}

const HANDLERS: Record<CommandId, (event: MenuCommandEvent) => boolean> = {
  'file.new': forwardToMain,
  'file.open': forwardToMain,
  'file.openFolder': forwardToMain,
  'file.closeFolder': forwardToMain,
  'file.close': forwardToMain,
  'file.quickOpen': () => (uiStore.set({ quickOpenOpen: !uiStore.get().quickOpenOpen }), true),
  'file.preferences': () => (uiStore.set({ settingsOpen: true, quickOpenOpen: false }), true),
  'file.save': (e) => (void saveDocument({ thenClose: e.thenClose }), true),
  'file.saveAs': (e) => (void saveDocument({ saveAs: true, thenClose: e.thenClose }), true),
  'edit.undo': () => runHistory('undo'),
  'edit.redo': () => runHistory('redo'),
  'edit.find': () => find(false),
  'edit.replace': () => find(true),
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
  'paragraph.table': () => insertTable(),
  'paragraph.horizontalRule': () => runVisual(insertHorizontalRule),
  'format.bold': () => runVisual(toggleBold),
  'format.italic': () => runVisual(toggleItalic),
  'format.code': () => runVisual(toggleInlineCode),
  'format.strikethrough': () => runVisual(toggleStrikethrough),
  'format.link': () => withVisualView((view) => openLinkEditor(view)),
  'view.sourceMode': () => (toggleSourceMode(), true),
  'view.toggleSidebar': () => (uiStore.set({ sidebarOpen: !uiStore.get().sidebarOpen }), true),
  'view.outline': () => (toggleSidebarTab('outline'), true),
  'view.files': () => (toggleSidebarTab('files'), true),
  'view.search': () => openSearch()
}

/** Run a command. Returns false if it does not apply right now (e.g. bold in source mode). */
export function runCommand(event: MenuCommandEvent): boolean {
  return HANDLERS[event.id](event)
}
