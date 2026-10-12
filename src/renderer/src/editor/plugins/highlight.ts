import { markRule } from '@milkdown/kit/prose'
import { toggleMark } from '@milkdown/kit/prose/commands'
import type { Command } from '@milkdown/kit/prose/state'
import { $inputRule, $markSchema, $remark } from '@milkdown/kit/utils'
import remarkHighlight from '../../markdown/remarkHighlight'

// Highlighted text, written `==like this==` (Typora's syntax). Shortcut: Ctrl+Shift+H.

export const remarkHighlightPlugin = $remark('remarkHighlight', () => remarkHighlight)

export const highlightSchema = $markSchema('highlight', () => ({
  parseDOM: [{ tag: 'mark' }],
  toDOM: () => ['mark', { class: 'md-highlight' }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'highlight',
    runner: (state, node, markType) => {
      state.openMark(markType)
      state.next(node.children)
      state.closeMark(markType)
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'highlight',
    runner: (state, mark) => {
      state.withMark(mark, 'highlight')
    }
  }
}))

export const highlightInputRule = $inputRule((ctx) =>
  markRule(/(?<![=\w])(==)([^=\s](?:[^=]*[^=\s])?)==$/, highlightSchema.type(ctx))
)

export const toggleHighlight: Command = (state, dispatch) =>
  toggleMark(state.schema.marks.highlight)(state, dispatch)

export const highlight = [remarkHighlightPlugin, highlightSchema, highlightInputRule].flat()
