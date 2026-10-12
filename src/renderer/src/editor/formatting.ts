import { setBlockType, toggleMark, wrapIn } from '@milkdown/kit/prose/commands'
import type { NodeType } from '@milkdown/kit/prose/model'
import { liftListItem, wrapInList } from '@milkdown/kit/prose/schema-list'
import { TextSelection, type Command } from '@milkdown/kit/prose/state'
import { liftTarget } from '@milkdown/kit/prose/transform'

// Typora-style paragraph and format commands. Applying a block format the selection already
// has turns it back into a paragraph (or unwraps it), so every shortcut is a toggle.

export const toggleHeading =
  (level: number): Command =>
  (state, dispatch) => {
    const { heading, paragraph } = state.schema.nodes
    const parent = state.selection.$from.parent
    if (parent.type === heading && parent.attrs.level === level) {
      return setBlockType(paragraph)(state, dispatch)
    }
    return setBlockType(heading, { level })(state, dispatch)
  }

export const toParagraph: Command = (state, dispatch) =>
  setBlockType(state.schema.nodes.paragraph)(state, dispatch)

export const toggleBlockquote: Command = (state, dispatch) => {
  const { blockquote } = state.schema.nodes
  const { $from, $to } = state.selection
  const range = $from.blockRange($to, (node) => node.type === blockquote)
  if (range) {
    const target = liftTarget(range)
    if (target === null) return false
    dispatch?.(state.tr.lift(range, target).scrollIntoView())
    return true
  }
  return wrapIn(blockquote)(state, dispatch)
}

const toggleList =
  (typeName: 'bullet_list' | 'ordered_list'): Command =>
  (state, dispatch) => {
    const { nodes } = state.schema
    const listType: NodeType = nodes[typeName]
    const isList = (type: NodeType): boolean =>
      type === nodes.bullet_list || type === nodes.ordered_list
    const { $from, $to } = state.selection
    const range = $from.blockRange($to, (node) => isList(node.type))
    if (!range) return wrapInList(listType)(state, dispatch)

    if (range.parent.type === listType) return liftListItem(nodes.list_item)(state, dispatch)

    // Inside the other kind of list: switch that list's type. Milkdown's list items carry
    // their own `listType` too (its list-sync plugin converts the list back otherwise).
    if (dispatch) {
      const listPos = range.$from.before(range.depth)
      const ordered = typeName === 'ordered_list'
      const tr = state.tr.setNodeMarkup(listPos, listType, { spread: range.parent.attrs.spread })
      range.parent.forEach((item, offset, index) => {
        tr.setNodeMarkup(listPos + 1 + offset, undefined, {
          ...item.attrs,
          listType: ordered ? 'ordered' : 'bullet',
          label: ordered ? `${index + 1}.` : '•'
        })
      })
      dispatch(tr)
    }
    return true
  }

export const toggleBulletList = toggleList('bullet_list')
export const toggleOrderedList = toggleList('ordered_list')

export const toggleCodeBlock: Command = (state, dispatch) => {
  const { code_block, paragraph } = state.schema.nodes
  if (state.selection.$from.parent.type === code_block) {
    return setBlockType(paragraph)(state, dispatch)
  }
  return setBlockType(code_block)(state, dispatch)
}

/** Insert a horizontal rule after the current top-level block, with a paragraph below it. */
export const insertHorizontalRule: Command = (state, dispatch) => {
  const { hr, paragraph } = state.schema.nodes
  const { $from } = state.selection
  if ($from.depth < 1) return false
  if (dispatch) {
    const pos = $from.after(1)
    const tr = state.tr.insert(pos, [hr.create(), paragraph.create()])
    tr.setSelection(TextSelection.create(tr.doc, pos + 2)).scrollIntoView()
    dispatch(tr)
  }
  return true
}

export const toggleBold: Command = (state, dispatch) =>
  toggleMark(state.schema.marks.strong)(state, dispatch)

export const toggleItalic: Command = (state, dispatch) =>
  toggleMark(state.schema.marks.emphasis)(state, dispatch)

export const toggleInlineCode: Command = (state, dispatch) =>
  toggleMark(state.schema.marks.inlineCode)(state, dispatch)
