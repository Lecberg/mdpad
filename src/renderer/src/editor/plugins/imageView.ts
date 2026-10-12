import { imageSchema } from '@milkdown/kit/preset/commonmark'
import type { Node } from '@milkdown/kit/prose/model'
import { $view } from '@milkdown/kit/utils'
import { documentStore } from '../../state/documentStore'
import { imageDisplayUrl } from '../imageUrl'

// Displays Markdown images, resolving local paths against the document's folder. If an
// image can't be loaded, its alt text and path are shown instead.

function render(dom: HTMLElement, node: Node): void {
  const src = node.attrs.src as string
  const alt = (node.attrs.alt as string) || ''
  const title = (node.attrs.title as string) || ''
  const url = imageDisplayUrl(src, documentStore.get().path)

  dom.replaceChildren()
  dom.title = title || src

  const showBroken = (): void => {
    dom.classList.add('md-image-broken')
    dom.replaceChildren(document.createTextNode(`🖼 ${alt || src || 'image'}`))
  }

  if (!url) {
    showBroken()
    return
  }
  dom.classList.remove('md-image-broken')
  const img = document.createElement('img')
  img.src = url
  img.alt = alt
  img.draggable = false
  img.addEventListener('error', showBroken, { once: true })
  dom.append(img)
}

export const imageView = $view(imageSchema.node, () => (initialNode) => {
  let node = initialNode
  const dom = document.createElement('span')
  dom.className = 'md-image'
  render(dom, node)
  return {
    dom,
    update: (next) => {
      if (next.type !== node.type) return false
      if (next.attrs.src !== node.attrs.src || next.attrs.alt !== node.attrs.alt) render(dom, next)
      node = next
      return true
    },
    ignoreMutation: () => true
  }
})
