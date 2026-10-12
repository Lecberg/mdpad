import type { Node } from '@milkdown/kit/prose/model'
import { Plugin } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'
import {
  activeHeadingIndex,
  countCharacters,
  countWords,
  docInfoStore,
  outlineFromDoc
} from '../../state/docInfoStore'

const UPDATE_DELAY_MS = 120

/** Keeps the outline, active heading and word count in docInfoStore up to date. */
export const docInfo = $prose(
  () =>
    new Plugin({
      view: (view) => {
        let lastDoc: Node | null = null
        let timer: ReturnType<typeof setTimeout> | undefined

        const update = (): void => {
          timer = undefined
          const { doc, selection } = view.state
          if (doc !== lastDoc) {
            lastDoc = doc
            const text = doc.textBetween(0, doc.content.size, '\n', ' ')
            docInfoStore.set({
              outline: outlineFromDoc(doc),
              words: countWords(text),
              characters: countCharacters(text)
            })
          }
          const outline = docInfoStore.get().outline
          const active = activeHeadingIndex(outline, selection.from - 1)
          if (active !== docInfoStore.get().activeHeading)
            docInfoStore.set({ activeHeading: active })
        }

        update()
        return {
          update: () => {
            timer ??= setTimeout(update, UPDATE_DELAY_MS)
          },
          destroy: () => clearTimeout(timer)
        }
      }
    })
)
