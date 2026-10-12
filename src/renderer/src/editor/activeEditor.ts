import type { Editor } from '@milkdown/kit/core'

// The window's single editor instance, for commands that run outside React.
let active: Editor | null = null

export function setActiveEditor(editor: Editor | null): void {
  active = editor
}

export function getActiveEditor(): Editor | null {
  return active
}
