import { Plugin } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'

/**
 * Clicking a task item's checkbox (drawn by CSS in the list item's left gutter, so the
 * click lands on the <li> itself rather than its text) toggles it.
 */
export const taskToggle = $prose(
  () =>
    new Plugin({
      props: {
        handleDOMEvents: {
          mousedown: (view, event) => {
            const target = event.target as HTMLElement
            if (target.tagName !== 'LI' || target.dataset.itemType !== 'task') return false
            const pos = view.posAtDOM(target, 0) - 1
            const node = view.state.doc.nodeAt(pos)
            if (!node || node.type.name !== 'list_item' || node.attrs.checked == null) return false
            event.preventDefault()
            view.dispatch(
              view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                checked: !node.attrs.checked
              })
            )
            return true
          }
        }
      }
    })
)
