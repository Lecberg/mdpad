import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  parserCtx,
  remarkStringifyOptionsCtx,
  rootCtx,
  serializerCtx
} from '@milkdown/kit/core'
import type { Ctx, MilkdownPlugin } from '@milkdown/kit/ctx'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { cursor } from '@milkdown/kit/plugin/cursor'
import { history } from '@milkdown/kit/plugin/history'
import { indent } from '@milkdown/kit/plugin/indent'
import { trailing } from '@milkdown/kit/plugin/trailing'
import { commonmark, remarkPreserveEmptyLinePlugin } from '@milkdown/kit/preset/commonmark'
import type { Node } from '@milkdown/kit/prose/model'
import { Plugin } from '@milkdown/kit/prose/state'
import { Transform } from '@milkdown/kit/prose/transform'
import { $prose } from '@milkdown/kit/utils'
import { STRINGIFY_OPTIONS } from '../markdown/stringifyOptions'
import { docInfo } from './plugins/docInfo'
import { linkClick } from './plugins/linkClick'
import { syntaxReveal } from './plugins/syntaxReveal'

// The editor configuration shared by the app and the headless round-trip tests, so the
// tests exercise exactly what the app saves.

// Milkdown writes empty paragraphs as `<br />` to preserve blank lines. Typora (and plain
// Markdown) simply drop them, so leave that plugin out.
const emptyLinePlugins: MilkdownPlugin[] = [...remarkPreserveEmptyLinePlugin]
const commonmarkPlugins = commonmark.filter((plugin) => !emptyLinePlugins.includes(plugin))

/**
 * Empty paragraphs (e.g. from pressing Enter twice) are dropped when saving, as in Typora;
 * otherwise they serialize as runs of blank lines. A container keeps at least one child,
 * and a list item keeps its leading paragraph.
 */
export function withoutEmptyParagraphs(doc: Node): Node {
  const positions: number[] = []
  const collect = (node: Node, contentStart: number): void => {
    const removable: number[] = []
    node.forEach((child, offset, index) => {
      const pos = contentStart + offset
      const isEmptyParagraph = child.type.name === 'paragraph' && child.content.size === 0
      if (isEmptyParagraph && !(node.type.name === 'list_item' && index === 0)) {
        removable.push(pos)
      } else if (!child.isTextblock && !child.isLeaf) {
        collect(child, pos + 1)
      }
    })
    if (removable.length === node.childCount) removable.shift()
    positions.push(...removable)
  }
  collect(doc, 0)
  if (positions.length === 0) return doc
  const tr = new Transform(doc)
  for (const pos of positions.sort((a, b) => b - a)) tr.delete(pos, pos + 2)
  return tr.doc
}

function serializeDoc(ctx: Ctx, doc: Node): string {
  return ctx.get(serializerCtx)(withoutEmptyParagraphs(doc))
}

/** Serializing is too costly for every keystroke; wait for a pause in typing. */
const SERIALIZE_DELAY_MS = 150

export interface MarkdownEditorOptions {
  root: HTMLElement
  markdown: string
  /** Called synchronously on every document change, before it is serialized. */
  onTouched?: () => void
  /** Called after a pause in changes with the serialized Markdown. */
  onChange?: (markdown: string) => void
}

function changeTracker(
  onTouched: (() => void) | undefined,
  onChange: ((markdown: string) => void) | undefined
): MilkdownPlugin {
  return $prose(
    (ctx) =>
      new Plugin({
        view: (view) => {
          let timer: ReturnType<typeof setTimeout> | undefined
          return {
            update: (_view, prevState) => {
              if (view.state.doc.eq(prevState.doc)) return
              onTouched?.()
              clearTimeout(timer)
              timer = setTimeout(
                () => onChange?.(serializeDoc(ctx, view.state.doc)),
                SERIALIZE_DELAY_MS
              )
            },
            destroy: () => clearTimeout(timer)
          }
        }
      })
  )
}

export function createMarkdownEditor({
  root,
  markdown,
  onTouched,
  onChange
}: MarkdownEditorOptions): Editor {
  return Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, markdown)
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({ ...prev, ...STRINGIFY_OPTIONS }))
    })
    .use(commonmarkPlugins)
    .use(history)
    .use(clipboard)
    .use(indent)
    .use(cursor)
    .use(trailing)
    .use(changeTracker(onTouched, onChange))
    .use(syntaxReveal)
    .use(linkClick)
    .use(docInfo)
}

/** Current document as Markdown. */
export function serializeEditor(editor: Editor): string {
  return editor.action((ctx) => serializeDoc(ctx, ctx.get(editorViewCtx).state.doc))
}

/** Parse then serialize `markdown` with the editor's schema, without touching its document. */
export function normalizeWith(editor: Editor, markdown: string): string {
  return editor.action((ctx) => {
    const doc = ctx.get(parserCtx)(markdown)
    return ctx.get(serializerCtx)(doc)
  })
}
