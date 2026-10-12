import type { Node } from '@milkdown/kit/prose/model'
import { Plugin } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'
import {
  activeHeadingIndex,
  countCharacters,
  countWords,
  docInfoStore,
  outlineFromDoc,
  type OutlineItem
} from '../../state/docInfoStore'

/** How often the active heading follows the caret. */
const SELECTION_DELAY_MS = 120
/** Outline and word count are recomputed over the whole document after a pause in typing. */
const docDelay = (doc: Node): number => Math.min(1500, 250 + doc.content.size / 2000)

const sameOutline = (a: OutlineItem[], b: OutlineItem[]): boolean =>
  a.length === b.length &&
  a.every((x, i) => x.level === b[i].level && x.text === b[i].text && x.target === b[i].target)

/** Keeps the outline, active heading and word count in docInfoStore up to date. */
export const docInfo = $prose(
  () =>
    new Plugin({
      view: (view) => {
        let lastDoc: Node | null = null
        let docTimer: ReturnType<typeof setTimeout> | undefined
        let selectionTimer: ReturnType<typeof setTimeout> | undefined

        // Only store what changed, so the outline and status bar re-render only when needed.
        const updateDoc = (): void => {
          docTimer = undefined
          const { doc } = view.state
          if (doc === lastDoc) return
          lastDoc = doc
          const text = doc.textBetween(0, doc.content.size, '\n', ' ')
          const outline = outlineFromDoc(doc)
          const words = countWords(text)
          const characters = countCharacters(text)
          const info = docInfoStore.get()
          if (!sameOutline(outline, info.outline)) docInfoStore.set({ outline })
          if (words !== info.words || characters !== info.characters) {
            docInfoStore.set({ words, characters })
          }
          updateSelection()
        }

        const updateSelection = (): void => {
          selectionTimer = undefined
          const { outline, activeHeading } = docInfoStore.get()
          // Between full updates, heading positions can be slightly out of date after edits;
          // the next full update corrects them.
          const active = activeHeadingIndex(outline, view.state.selection.from - 1)
          if (active !== activeHeading) docInfoStore.set({ activeHeading: active })
        }

        updateDoc()
        return {
          update: (_view, prevState) => {
            if (view.state.doc !== prevState.doc) {
              clearTimeout(docTimer)
              docTimer = setTimeout(updateDoc, docDelay(view.state.doc))
            } else if (!view.state.selection.eq(prevState.selection)) {
              selectionTimer ??= setTimeout(updateSelection, SELECTION_DELAY_MS)
            }
          },
          destroy: () => {
            clearTimeout(docTimer)
            clearTimeout(selectionTimer)
          }
        }
      }
    })
)
