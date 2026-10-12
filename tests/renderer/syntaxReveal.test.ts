import { afterEach, describe, expect, it } from 'vitest'
import { editorViewCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { buildSyntaxDecorations } from '@renderer/editor/plugins/syntaxReveal'
import { markRangeAt } from '@renderer/editor/markRange'
import { findBlock, openSession, type Session } from '../markdown/helpers'

let session: Session | null = null
afterEach(async () => {
  await session?.destroy()
  session = null
})

/** Marker texts that would be shown with the caret `offset` characters into `blockText`. */
async function markersAt(markdown: string, blockText: string, offset: number): Promise<string[]> {
  session = await openSession(markdown)
  const start = findBlock(session.editor, (n) => n.textContent === blockText)
  return session.editor.action((ctx) => {
    const view: EditorView = ctx.get(editorViewCtx)
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start + offset)))
    const decorations = buildSyntaxDecorations(view.state).find()
    return decorations.map((d) => {
      const toDOM = (d as unknown as { type: { toDOM: (v: EditorView) => HTMLElement } }).type.toDOM
      return toDOM(view).textContent ?? ''
    })
  })
}

describe('syntax reveal', () => {
  it('shows nothing in plain text', async () => {
    expect(await markersAt('plain **bold** text\n', 'plain bold text', 2)).toEqual([])
  })

  it('shows ** around bold text containing the caret', async () => {
    expect(await markersAt('plain **bold** text\n', 'plain bold text', 8)).toEqual(['**', '**'])
  })

  it('keeps the original emphasis marker', async () => {
    expect(await markersAt('an _underscore_ word\n', 'an underscore word', 5)).toEqual(['_', '_'])
  })

  it('shows backticks for inline code', async () => {
    expect(await markersAt('run `npm test` now\n', 'run npm test now', 6)).toEqual(['`', '`'])
  })

  it('shows link brackets and the URL', async () => {
    expect(await markersAt('see [docs](https://x.dev) here\n', 'see docs here', 6)).toEqual([
      '[',
      '](https://x.dev)'
    ])
  })

  it('shows the heading level', async () => {
    expect(await markersAt('### Title\n', 'Title', 2)).toEqual(['###'])
  })
})

describe('markRangeAt', () => {
  it('separates adjacent links with different targets', async () => {
    session = await openSession('[a](https://a.dev)[b](https://b.dev)\n')
    const start = findBlock(session.editor, (n) => n.textContent === 'ab')
    const range = session.editor.action((ctx) => {
      const { state } = ctx.get(editorViewCtx)
      return markRangeAt(state.doc.resolve(start + 2), state.schema.marks.link)
    })
    expect(range?.mark.attrs.href).toBe('https://b.dev')
    expect(range && range.to - range.from).toBe(1)
  })
})
