import { Plugin } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'

// A code block with a rendered preview (math, diagram) shows only the preview until it is
// focused. Clicking the preview focuses the block's source editor. (Listens on the editor
// element directly: the code block's node view stops events before ProseMirror sees them.)
export const previewFocus = $prose(
  () =>
    new Plugin({
      view: (view) => {
        const onMouseDown = (event: MouseEvent): void => {
          const target = event.target as HTMLElement
          const block = target.closest?.('.milkdown-code-block')
          if (!block || !target.closest('.preview-panel')) return
          if (block.contains(document.activeElement)) return
          const source = block.querySelector<HTMLElement>('.cm-content')
          if (!source) return
          event.preventDefault()
          source.focus()
        }
        view.dom.addEventListener('mousedown', onMouseDown, true)
        return { destroy: () => view.dom.removeEventListener('mousedown', onMouseDown, true) }
      }
    })
)
