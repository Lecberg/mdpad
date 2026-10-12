// Writing modes from the View menu, read by the editors' plugins. Set from settings
// (settingsStore.ts); the CSS side is a class on the app element (App.tsx).
export const viewModes = {
  /** Keep the caret's line in the middle of the window while typing. */
  typewriter: false
}

/** Scroll the editor so a caret at viewport y-coordinate `caretTop` is centered. */
export function centerCaret(caretTop: number, editorDom: HTMLElement): void {
  const scroller = editorDom.closest('.editor-scroll')
  if (!scroller) return
  const rect = scroller.getBoundingClientRect()
  const delta = caretTop - (rect.top + rect.height / 2)
  if (Math.abs(delta) > 2) scroller.scrollTop += delta
}
