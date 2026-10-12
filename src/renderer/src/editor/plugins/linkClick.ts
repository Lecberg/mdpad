import { Plugin } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'
import { openHref } from '../links'
import { markRangeAt } from '../markRange'
import { scrollToVisualTarget } from '../navigation'

/** Ctrl+click on a link opens it (a plain click just places the caret, as in Typora). */
export const linkClick = $prose(
  () =>
    new Plugin({
      props: {
        handleClick: (view, pos, event) => {
          if (!event.ctrlKey) return false
          const range = markRangeAt(view.state.doc.resolve(pos), view.state.schema.marks.link)
          if (!range) return false
          openHref(range.mark.attrs.href as string, (target) => scrollToVisualTarget(view, target))
          return true
        }
      }
    })
)
