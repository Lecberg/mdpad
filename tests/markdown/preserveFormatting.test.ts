import { describe, expect, it } from 'vitest'
import { editorViewCtx } from '@milkdown/kit/core'
import { serializeEditor } from '@renderer/editor/markdownCore'
import {
  applyFinalNewline,
  ensureFinalNewline,
  mergeEdits
} from '@renderer/markdown/preserveFormatting'
import { appendParagraph, deleteTopLevelBlock, findBlock, insertText, openSession } from './helpers'

const identity = (md: string): string => md

describe('final newline helpers', () => {
  it('adds or removes the trailing newline', () => {
    expect(ensureFinalNewline('a')).toBe('a\n')
    expect(ensureFinalNewline('')).toBe('')
    expect(applyFinalNewline('a\n\n', false)).toBe('a')
    expect(applyFinalNewline('a', true)).toBe('a\n')
  })
})

describe('mergeEdits (pure)', () => {
  it('returns the original when nothing was edited', () => {
    expect(mergeEdits('A\n===\n', '# A\n', '# A\n', identity)).toBe('A\n===\n')
  })

  it('returns current when the editor did not normalize anything', () => {
    expect(mergeEdits('a\n', 'a\n', 'b\n', identity)).toBe('b\n')
  })

  it('falls back to current when the merge would not parse back to current', () => {
    // A normalizer under which the merged text and current load as different documents.
    const strict = (md: string): string => md.replace(/^\* /gm, 'STAR ')
    expect(mergeEdits('* a\n\nx\n', '- a\n\nx\n', '- a\n\ny\n', strict)).toBe('- a\n\ny\n')
  })
})

describe('mergeEdits with the real editor', () => {
  const original = [
    'Title',
    '=====',
    '',
    '* star one',
    '* star two',
    '',
    'First paragraph.',
    '',
    'Second paragraph.',
    ''
  ].join('\n')

  it('keeps untouched normalized syntax when another block is edited', async () => {
    const s = await openSession(original)
    insertText(
      s.editor,
      findBlock(s.editor, (n) => n.textContent === 'First paragraph.'),
      'New '
    )
    expect(s.saveText()).toBe(original.replace('First paragraph.', 'New First paragraph.'))
    await s.destroy()
  })

  it('keeps untouched syntax when a block is deleted', async () => {
    const s = await openSession(original)
    deleteTopLevelBlock(
      s.editor,
      findBlock(s.editor, (n) => n.textContent === 'First paragraph.')
    )
    expect(s.saveText()).toBe(original.replace('First paragraph.\n\n', ''))
    await s.destroy()
  })

  it('keeps untouched syntax when a paragraph is appended', async () => {
    const s = await openSession(original)
    appendParagraph(s.editor, 'Appended.')
    expect(s.saveText()).toBe(original + '\nAppended.\n')
    await s.destroy()
  })

  it('keeps untouched syntax when an empty paragraph is left in the document', async () => {
    const s = await openSession(original)
    const pos = findBlock(s.editor, (n) => n.textContent === 'First paragraph.')
    s.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const $pos = view.state.doc.resolve(pos)
      view.dispatch(view.state.tr.insert($pos.after(1), view.state.schema.nodes.paragraph.create()))
    })
    const saved = s.saveText()
    expect(saved.startsWith('Title\n=====\n\n* star one\n* star two\n')).toBe(true)
    expect(saved).not.toContain('<br')
    await s.destroy()
  })

  it('writes a valid document when editing a line the editor normalizes', async () => {
    const s = await openSession(original)
    insertText(
      s.editor,
      findBlock(s.editor, (n) => n.textContent === 'star one'),
      'EDITED '
    )
    const saved = s.saveText()
    // Whatever was merged, it must load back as exactly what the user sees.
    const reopened = await openSession(saved)
    expect(reopened.baseline).toBe(serializeEditor(s.editor))
    // Lines outside the edited list are still untouched.
    expect(saved.startsWith('Title\n=====\n')).toBe(true)
    await reopened.destroy()
    await s.destroy()
  })
})
