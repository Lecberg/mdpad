import type { Editor } from '@milkdown/kit/core'
import type { EditorView as SourceView } from '@codemirror/view'

// The window's editor instances, for commands that run outside React. Only one is mounted
// at a time: the visual (Milkdown) editor or the source (CodeMirror) editor.
let visual: Editor | null = null
let source: SourceView | null = null

export function setActiveEditor(editor: Editor | null): void {
  visual = editor
}

export function getActiveEditor(): Editor | null {
  return visual
}

export function setActiveSourceView(view: SourceView | null): void {
  source = view
}

export function getActiveSourceView(): SourceView | null {
  return source
}

/** Put keyboard focus back in the document (e.g. after closing a dialog). */
export function focusEditor(): void {
  if (source) {
    source.focus()
    return
  }
  const dom = document.querySelector<HTMLElement>('.ProseMirror')
  dom?.focus({ preventScroll: true })
}
