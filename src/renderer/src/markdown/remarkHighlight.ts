import type { Nodes, Parent, PhrasingContent, Root, Text } from 'mdast'
import type { Handle, Options as ToMarkdownExtension } from 'mdast-util-to-markdown'
import type { Processor } from 'unified'

// Highlight: `==marked text==` (Typora's syntax). Parsed after the rest of the inline
// syntax, by pairing `==` delimiters found in text nodes, so the highlighted text may
// itself contain other formatting (`==a *b* c==`).

/** mdast node for highlighted text. */
export interface Highlight extends Parent {
  type: 'highlight'
  children: PhrasingContent[]
}

declare module 'mdast' {
  interface PhrasingContentMap {
    highlight: Highlight
  }
  interface RootContentMap {
    highlight: Highlight
  }
}

// An opening `==` is followed by a non-space, non-`=`; a closing one is preceded by one.
// Neither may be part of a longer run of `=` (as in `a === b`).
const OPENER = /(?<!=)==(?![\s=])/g
const CLOSER = /(?<![\s=])==(?!=)/g

function findCloser(value: string, from: number, canStartAtZero: boolean): number {
  CLOSER.lastIndex = from
  for (let m = CLOSER.exec(value); m; m = CLOSER.exec(value)) {
    if (m.index > 0 || canStartAtZero) return m.index
  }
  return -1
}

const text = (value: string): Text => ({ type: 'text', value })

/** Pair `==` delimiters among one container's children (recursing into inline children). */
function pairDelimiters(children: PhrasingContent[]): void {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.type !== 'text') {
      if ('children' in child) pairDelimiters(child.children as PhrasingContent[])
      continue
    }
    OPENER.lastIndex = 0
    for (let open = OPENER.exec(child.value); open; open = OPENER.exec(child.value)) {
      const k = open.index
      // Closing delimiter in the same text node…
      const sameNode = findCloser(child.value, k + 3, false)
      if (sameNode >= 0) {
        const parts: PhrasingContent[] = []
        if (k > 0) parts.push(text(child.value.slice(0, k)))
        parts.push({ type: 'highlight', children: [text(child.value.slice(k + 2, sameNode))] })
        const rest = child.value.slice(sameNode + 2)
        if (rest) parts.push(text(rest))
        children.splice(i, 1, ...parts)
        i += parts.length - 2 // continue with the remaining text (if any)
        break
      }
      // …or in a later text sibling, with other inline nodes in between.
      let matched = false
      for (let j = i + 1; j < children.length; j++) {
        const later = children[j]
        if (later.type !== 'text') continue
        const close = findCloser(later.value, 0, children[j - 1].type !== 'text')
        if (close < 0) continue
        const inner: PhrasingContent[] = []
        const head = child.value.slice(k + 2)
        if (head) inner.push(text(head))
        inner.push(...children.slice(i + 1, j))
        const tail = later.value.slice(0, close)
        if (tail) inner.push(text(tail))
        pairDelimiters(inner.filter((n) => n.type !== 'text'))
        const parts: PhrasingContent[] = []
        if (k > 0) parts.push(text(child.value.slice(0, k)))
        parts.push({ type: 'highlight', children: inner })
        const rest = later.value.slice(close + 2)
        if (rest) parts.push(text(rest))
        children.splice(i, j - i + 1, ...parts)
        i += parts.length - 2
        matched = true
        break
      }
      if (matched) break
    }
  }
}

function transform(node: Nodes): void {
  if (!('children' in node)) return
  const children = node.children as Nodes[]
  if (children.some((c) => c.type === 'text')) pairDelimiters(children as PhrasingContent[])
  else for (const child of children) transform(child)
}

export const highlightHandler: Handle = (node, _parent, state, info) => {
  const tracker = state.createTracker(info)
  let value = tracker.move('==')
  value += tracker.move(
    state.containerPhrasing(node as Highlight, { ...tracker.current(), before: value, after: '=' })
  )
  value += tracker.move('==')
  return value
}

export const highlightToMarkdown: ToMarkdownExtension = {
  handlers: { highlight: highlightHandler }
}

export default function remarkHighlight(this: Processor): (tree: Root) => void {
  const data = this.data() as { toMarkdownExtensions?: unknown[] }
  ;(data.toMarkdownExtensions ??= []).push(highlightToMarkdown)
  return (tree) => transform(tree)
}
