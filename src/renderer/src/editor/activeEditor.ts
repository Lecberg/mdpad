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
