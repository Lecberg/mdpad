import type { Editor } from '@milkdown/kit/core'
import { editorViewCtx } from '@milkdown/kit/core'
import type { Node } from '@milkdown/kit/prose/model'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { decodeText } from '../../src/main/services/fileService'
import { createMarkdownEditor, normalizeWith, serializeEditor } from '@renderer/editor/markdownCore'
import { textToSave } from '@renderer/markdown/saveText'

export const fixturesDir = join(__dirname, '../fixtures')

export const fixtureNames = (): string[] =>
  readdirSync(fixturesDir).filter((name) => /\.(md|markdown)$/i.test(name) && name !== 'README.md')

export function readFixture(name: string): { raw: Buffer } & ReturnType<typeof decodeText> {
  const raw = readFileSync(join(fixturesDir, name))
  return { raw, ...decodeText(raw) }
}

/** A loaded headless editor plus the document bookkeeping the app keeps for it. */
export interface Session {
  editor: Editor
  original: string
  baseline: string
  finalNewline: boolean
  /** Text the app would write now (LF, before EOL/BOM encoding). */
  saveText(): string
  destroy(): Promise<void>
}

export async function openSession(original: string): Promise<Session> {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await createMarkdownEditor({ root, markdown: original }).create()
  const baseline = serializeEditor(editor)
  const finalNewline = original === '' || original.endsWith('\n')
  return {
    editor,
    original,
    baseline,
    finalNewline,
    saveText() {
      const current = serializeEditor(editor)
      return textToSave(
        {
          original,
          baseline,
          dirty: current !== baseline,
          format: { eol: '\n', bom: false, finalNewline }
        },
        current,
        (md) => normalizeWith(editor, md)
      )
    },
    async destroy() {
      await editor.destroy()
      root.remove()
    }
  }
}

/** Position just inside the first block matching `predicate`. */
export function findBlock(editor: Editor, predicate: (node: Node) => boolean): number {
  return editor.action((ctx) => {
    let found = -1
    ctx.get(editorViewCtx).state.doc.descendants((node, pos) => {
      if (found >= 0) return false
      if (node.isTextblock && predicate(node)) {
        found = pos + 1
        return false
      }
      return true
    })
    if (found < 0) throw new Error('block not found')
    return found
  })
}

export function insertText(editor: Editor, pos: number, text: string): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.dispatch(view.state.tr.insertText(text, pos))
  })
}

/** Delete the top-level block containing `pos`. */
export function deleteTopLevelBlock(editor: Editor, pos: number): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const $pos = view.state.doc.resolve(pos)
    view.dispatch(view.state.tr.delete($pos.before(1), $pos.after(1)))
  })
}

export function appendParagraph(editor: Editor, text: string): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { state } = view
    const paragraph = state.schema.nodes.paragraph.create(null, state.schema.text(text))
    view.dispatch(state.tr.insert(state.doc.content.size, paragraph))
  })
}

/** Lines that differ between two texts of equal line count, as [before, after] pairs. */
export function changedLines(before: string, after: string): Array<[string, string]> {
  const a = before.split('\n')
  const b = after.split('\n')
  if (a.length !== b.length) throw new Error(`line count changed: ${a.length} → ${b.length}`)
  return a.flatMap((line, i) => (line === b[i] ? [] : [[line, b[i]] as [string, string]]))
}
