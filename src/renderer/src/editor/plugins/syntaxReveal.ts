import type { Mark } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey, type EditorState } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import { openLinkEditor } from '../links'
import { markRangeAt } from '../markRange'

// Typora-style syntax hints: while the caret is inside bold, italic, code, a link, or a
// heading, show that element's Markdown markers as faded, non-editable text around it.
// Decorations only; the document itself never changes.

export const syntaxRevealKey = new PluginKey<DecorationSet>('syntax-reveal')

const REVEALED_MARKS = ['strong', 'emphasis', 'inlineCode', 'strike_through', 'highlight', 'link']

function marker(text: string, className: string, onMouseDown?: (view: EditorView) => void) {
  return (view: EditorView): HTMLElement => {
    const span = document.createElement('span')
    span.className = className
    span.textContent = text
    span.contentEditable = 'false'
    span.setAttribute('aria-hidden', 'true')
    span.addEventListener('mousedown', (event) => {
      event.preventDefault()
      onMouseDown?.(view)
    })
    return span
  }
}

function delimiters(mark: Mark): [open: string, close: string] {
  switch (mark.type.name) {
    case 'strong': {
      const m = (mark.attrs.marker as string) || '*'
      return [m + m, m + m]
    }
    case 'emphasis': {
      const m = (mark.attrs.marker as string) || '*'
      return [m, m]
    }
    case 'inlineCode':
      return ['`', '`']
    case 'strike_through':
      return ['~~', '~~']
    case 'highlight':
      return ['==', '==']
    default: {
      const title = mark.attrs.title ? ` "${mark.attrs.title}"` : ''
      return ['[', `](${mark.attrs.href}${title})`]
    }
  }
}

export function buildSyntaxDecorations(state: EditorState): DecorationSet {
  const $head = state.selection.$head
  const decorations: Decoration[] = []

  const parent = $head.parent
  if (parent.type.name === 'heading') {
    const hashes = '#'.repeat(parent.attrs.level as number)
    decorations.push(
      Decoration.widget($head.start(), marker(hashes, 'md-syntax md-heading-marker'), {
        side: -1,
        key: `heading-${hashes}`,
        ignoreSelection: true
      })
    )
  }

  const candidates = [...($head.nodeBefore?.marks ?? []), ...($head.nodeAfter?.marks ?? [])]
  const seen = new Set<string>()
  for (const mark of candidates) {
    if (!REVEALED_MARKS.includes(mark.type.name) || seen.has(mark.type.name)) continue
    seen.add(mark.type.name)
    const range = markRangeAt($head, mark.type)
    if (!range) continue
    const [open, close] = delimiters(range.mark)
    const isLink = mark.type.name === 'link'
    decorations.push(
      Decoration.widget(range.from, marker(open, 'md-syntax'), {
        side: -1,
        key: `${mark.type.name}-open-${open}`,
        ignoreSelection: true
      }),
      Decoration.widget(
        range.to,
        marker(
          close,
          isLink ? 'md-syntax md-link-target' : 'md-syntax',
          isLink ? openLinkEditor : undefined
        ),
        { side: 1, key: `${mark.type.name}-close-${close}`, ignoreSelection: true }
      )
    )
  }

  return DecorationSet.create(state.doc, decorations)
}

export const syntaxReveal = $prose(
  () =>
    new Plugin<DecorationSet>({
      key: syntaxRevealKey,
      state: {
        init: (_, state) => buildSyntaxDecorations(state),
        apply: (tr, old, _oldState, newState) => {
          // Rebuilding decorations next to an active IME composition can break it; just
          // keep the existing ones in place until the composition ends.
          if (tr.getMeta('composition') !== undefined) return old.map(tr.mapping, tr.doc)
          if (!tr.docChanged && !tr.selectionSet) return old
          return buildSyntaxDecorations(newState)
        }
      },
      props: {
        decorations: (state) => syntaxRevealKey.getState(state)
      }
    })
)
