import { afterEach, describe, expect, it } from 'vitest'
import { editorViewCtx } from '@milkdown/kit/core'
import type { Command } from '@milkdown/kit/prose/state'
import { TextSelection } from '@milkdown/kit/prose/state'
import { serializeEditor } from '@renderer/editor/markdownCore'
import {
  insertHorizontalRule,
  toggleBlockquote,
  toggleBold,
  toggleBulletList,
  toggleCodeBlock,
  toggleHeading,
  toggleOrderedList,
  toParagraph
} from '@renderer/editor/formatting'
import { findBlock, openSession, type Session } from '../markdown/helpers'

let session: Session | null = null
afterEach(async () => {
  await session?.destroy()
  session = null
})

/** Open `markdown`, put the caret inside the block whose text is `blockText`, run commands. */
async function apply(markdown: string, blockText: string, ...commands: Command[]): Promise<string> {
  session = await openSession(markdown)
  const { editor } = session
  const pos = findBlock(editor, (n) => n.textContent === blockText)
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + 1)))
    for (const command of commands) command(view.state, view.dispatch, view)
  })
  return serializeEditor(editor)
}

describe('headings', () => {
  it('turns a paragraph into a heading of the given level', async () => {
    expect(await apply('Title\n', 'Title', toggleHeading(2))).toBe('## Title\n')
  })

  it('toggles back to a paragraph when applied twice', async () => {
    expect(await apply('Title\n', 'Title', toggleHeading(3), toggleHeading(3))).toBe('Title\n')
  })

  it('changes the level of an existing heading', async () => {
    expect(await apply('# Title\n', 'Title', toggleHeading(4))).toBe('#### Title\n')
  })

  it('turns a heading into a paragraph', async () => {
    expect(await apply('## Title\n', 'Title', toParagraph)).toBe('Title\n')
  })
})

describe('blockquote', () => {
  it('wraps and unwraps', async () => {
    expect(await apply('Quote me\n', 'Quote me', toggleBlockquote)).toBe('> Quote me\n')
    expect(await apply('> Quote me\n', 'Quote me', toggleBlockquote)).toBe('Quote me\n')
  })
})

describe('lists', () => {
  it('wraps a paragraph in a bullet list and unwraps it', async () => {
    expect(await apply('Item\n', 'Item', toggleBulletList)).toBe('- Item\n')
    expect(await apply('- Item\n', 'Item', toggleBulletList)).toBe('Item\n')
  })

  it('wraps in an ordered list', async () => {
    expect(await apply('Item\n', 'Item', toggleOrderedList)).toBe('1. Item\n')
  })

  it('switches an existing list between bullet and ordered', async () => {
    expect(await apply('- One\n- Two\n', 'One', toggleOrderedList)).toBe('1. One\n2. Two\n')
    expect(await apply('1. One\n2. Two\n', 'Two', toggleBulletList)).toBe('- One\n- Two\n')
  })
})

describe('code block', () => {
  it('converts a paragraph to a code block and back', async () => {
    expect(await apply('let x = 1\n', 'let x = 1', toggleCodeBlock)).toBe('```\nlet x = 1\n```\n')
    expect(await apply('```\nlet x = 1\n```\n', 'let x = 1', toggleCodeBlock)).toBe('let x = 1\n')
  })
})

describe('horizontal rule', () => {
  it('inserts a rule after the current block', async () => {
    const out = await apply('Above\n\nBelow\n', 'Above', insertHorizontalRule)
    expect(out).toBe('Above\n\n---\n\nBelow\n')
  })
})

describe('marks', () => {
  it('toggles bold on a selection', async () => {
    session = await openSession('make this bold\n')
    const { editor } = session
    const start = findBlock(editor, (n) => n.textContent === 'make this bold')
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const sel = TextSelection.create(view.state.doc, start + 10, start + 14)
      view.dispatch(view.state.tr.setSelection(sel))
      toggleBold(view.state, view.dispatch)
    })
    expect(serializeEditor(editor)).toBe('make this **bold**\n')
  })
})
