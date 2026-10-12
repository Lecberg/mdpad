import { afterEach, expect, it } from 'vitest'
import { editorViewCtx, type Editor } from '@milkdown/kit/core'
import type { Node } from '@milkdown/kit/prose/model'
import { serializeEditor, withoutEmptyParagraphs } from '@renderer/editor/markdownCore'
import { findBlock, openSession, type Session } from '../markdown/helpers'

let session: Session | null = null
afterEach(async () => {
  await session?.destroy()
  session = null
})

/** Insert empty paragraphs right after the block containing `blockText`. */
async function withEmptiesAfter(
  markdown: string,
  blockText: string,
  count: number
): Promise<Editor> {
  session = await openSession(markdown)
  const pos = findBlock(session.editor, (n) => n.textContent === blockText)
  session.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const $pos = view.state.doc.resolve(pos)
    const after = $pos.after($pos.depth)
    const empties = Array.from({ length: count }, () => view.state.schema.nodes.paragraph.create())
    view.dispatch(view.state.tr.insert(after, empties))
  })
  return session.editor
}

it('drops empty paragraphs between blocks (pressing Enter twice)', async () => {
  const editor = await withEmptiesAfter('One\n\nTwo\n', 'One', 3)
  expect(serializeEditor(editor)).toBe('One\n\nTwo\n')
})

it('drops empty paragraphs inside list items and quotes', async () => {
  const editor = await withEmptiesAfter('- item\n\n> quote\n', 'item', 1)
  expect(serializeEditor(editor)).toBe('- item\n\n> quote\n')
})

it('keeps a container valid when all its paragraphs are empty', async () => {
  session = await openSession('')
  const doc = session.editor.action((ctx) => {
    const { schema } = ctx.get(editorViewCtx).state
    return schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create()
    ])
  })
  const result: Node = withoutEmptyParagraphs(doc)
  expect(result.childCount).toBe(1)
  expect(() => result.check()).not.toThrow()
})
