import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import { centerCaret, viewModes } from '../viewModes'

/**
 * Focus mode: marks the blocks containing the caret (`md-focus-path`) — the paragraph and,
 * for nested content, its list item, list, quote… CSS dims their siblings when the app is
 * in focus mode (F8); outside it the class has no effect.
 */
export const focusPath = $prose(
  () =>
    new Plugin({
      props: {
        decorations(state) {
          const $head = state.selection.$head
          const decorations: Decoration[] = []
          for (let depth = 1; depth <= $head.depth; depth++) {
            const from = $head.before(depth)
            decorations.push(
              Decoration.node(from, from + $head.node(depth).nodeSize, { class: 'md-focus-path' })
            )
          }
          return DecorationSet.create(state.doc, decorations)
        }
      }
    })
)

const typewriterKey = new PluginKey<boolean>('typewriter')

/**
 * Typewriter mode: after typing or moving the caret with the keyboard, scroll so the caret's
 * line is in the middle of the window. Clicking doesn't scroll (the text would jump away
 * from the mouse).
 */
export const typewriter = $prose(
  () =>
    new Plugin<boolean>({
      key: typewriterKey,
      state: {
        init: () => false,
        // Whether the latest selection change came from the mouse.
        apply: (tr, fromPointer) =>
          tr.getMeta('pointer') ? true : tr.docChanged || tr.selectionSet ? false : fromPointer
      },
      view: () => ({
        update(view, prevState) {
          if (!viewModes.typewriter || typewriterKey.getState(view.state)) return
          if (view.state.selection.eq(prevState.selection) && view.state.doc.eq(prevState.doc)) {
            return
          }
          if (!view.hasFocus()) return
          centerCaret(view.coordsAtPos(view.state.selection.head).top, view.dom)
        }
      })
    })
)

/** Documents above this size (in characters) get rendering shortcuts (see app.css). */
const LARGE_DOCUMENT = 100_000

/**
 * Marks long documents so the browser can skip laying out blocks that are off screen
 * (`content-visibility`), which keeps typing responsive in very long notes.
 */
export const largeDocument = $prose(
  () =>
    new Plugin({
      props: {
        attributes: (state): Record<string, string> =>
          state.doc.content.size > LARGE_DOCUMENT ? { class: 'md-large-doc' } : {}
      }
    })
)
