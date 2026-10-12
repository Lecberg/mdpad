import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { EditorView as SourceView } from '@codemirror/view'

const smooth = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

/** Visual mode: put the caret at the start of the block at `pos` and scroll it to the top. */
export function scrollToVisualTarget(view: EditorView, pos: number): void {
  const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos + 1)))
  view.dispatch(tr)
  const dom = view.nodeDOM(pos)
  if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'start', behavior: smooth() })
  view.focus()
}

/** Source mode: put the caret at character `offset` and scroll its line to the top. */
export function scrollToSourceTarget(view: SourceView, offset: number): void {
  view.dispatch({
    selection: { anchor: offset },
    effects: SourceView.scrollIntoView(offset, { y: 'start', yMargin: 24 })
  })
  view.focus()
}
