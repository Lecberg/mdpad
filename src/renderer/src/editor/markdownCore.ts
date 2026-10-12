import {
  Editor,
  defaultValueCtx,
  parserCtx,
  remarkStringifyOptionsCtx,
  rootCtx,
  serializerCtx
} from '@milkdown/kit/core'
import type { MilkdownPlugin } from '@milkdown/kit/ctx'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { cursor } from '@milkdown/kit/plugin/cursor'
import { history } from '@milkdown/kit/plugin/history'
import { indent } from '@milkdown/kit/plugin/indent'
import { trailing } from '@milkdown/kit/plugin/trailing'
import { commonmark, remarkPreserveEmptyLinePlugin } from '@milkdown/kit/preset/commonmark'
import { Plugin } from '@milkdown/kit/prose/state'
import { $prose, getMarkdown } from '@milkdown/kit/utils'
import { STRINGIFY_OPTIONS } from '../markdown/stringifyOptions'

// The editor configuration shared by the app and the headless round-trip tests, so the
// tests exercise exactly what the app saves.

// Milkdown writes empty paragraphs as `<br />` to preserve blank lines. Typora (and plain
// Markdown) simply drop them, so leave that plugin out.
const emptyLinePlugins: MilkdownPlugin[] = [...remarkPreserveEmptyLinePlugin]
const commonmarkPlugins = commonmark.filter((plugin) => !emptyLinePlugins.includes(plugin))

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
                () => onChange?.(ctx.get(serializerCtx)(view.state.doc)),
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
}

/** Current document as Markdown. */
export function serializeEditor(editor: Editor): string {
  return editor.action(getMarkdown())
}

/** Parse then serialize `markdown` with the editor's schema, without touching its document. */
export function normalizeWith(editor: Editor, markdown: string): string {
  return editor.action((ctx) => {
    const doc = ctx.get(parserCtx)(markdown)
    return ctx.get(serializerCtx)(doc)
  })
}
