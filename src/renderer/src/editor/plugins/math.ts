import katex from 'katex'
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'
import type { Node } from '@milkdown/kit/prose/model'
import { InputRule, textblockTypeInputRule } from '@milkdown/kit/prose/inputrules'
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction
} from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $inputRule, $nodeSchema, $prose, $remark } from '@milkdown/kit/utils'
import remarkMath from '../../markdown/remarkMath'

// Math, as in Typora:
// - `$x^2$` inline math is shown rendered. Clicking it turns it back into its `$…$` source
//   (with a live preview) for editing; it renders again once the caret leaves.
// - `$$ … $$` display math is a code block with language "math": its source is edited in
//   the code block editor and the formula is shown rendered below (see interactive.ts).

export const remarkMathPlugin = $remark('remarkMath', () => remarkMath)

export function renderTex(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, { displayMode, throwOnError: false, output: 'htmlAndMathml' })
}

export const mathInlineSchema = $nodeSchema('math_inline', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  attrs: { value: { default: '' } },
  parseDOM: [
    {
      tag: 'span[data-type="math_inline"]',
      getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.value ?? '' })
    }
  ],
  toDOM: (node) => {
    const value = node.attrs.value as string
    const dom = document.createElement('span')
    dom.dataset.type = 'math_inline'
    dom.dataset.value = value
    dom.className = 'md-math-inline'
    dom.title = `$${value}$`
    dom.innerHTML = renderTex(value, false)
    return dom
  },
  parseMarkdown: {
    match: (node) => node.type === 'inlineMath',
    runner: (state, node, type) => {
      state.addNode(type, { value: node.value as string })
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_inline',
    runner: (state, node) => {
      state.addNode('inlineMath', undefined, node.attrs.value as string)
    }
  }
}))

/**
 * Display math lives in a code block with language "math" and `math: true`, so it is written
 * back as `$$…$$`. (A fenced ```math block keeps `math: false` and stays a fence.)
 */
export const mathBlockSchema = codeBlockSchema.extendSchema((prev) => (ctx) => {
  const base = prev(ctx)
  return {
    ...base,
    attrs: { ...base.attrs, math: { default: false } },
    parseDOM: [
      {
        tag: 'pre',
        preserveWhitespace: 'full' as const,
        getAttrs: (dom) => ({
          language: (dom as HTMLElement).dataset.language ?? '',
          math: (dom as HTMLElement).dataset.math === 'true'
        })
      }
    ],
    toDOM: (node) => {
      const spec = base.toDOM!(node) as [string, Record<string, string>, ...unknown[]]
      const [tag, attrs, ...rest] = spec
      return [tag, node.attrs.math ? { ...attrs, 'data-math': 'true' } : attrs, ...rest] as never
    },
    parseMarkdown: {
      match: (node) => node.type === 'math' || base.parseMarkdown.match(node),
      runner: (state, node, type) => {
        if (node.type !== 'math') return base.parseMarkdown.runner(state, node, type)
        state.openNode(type, { language: 'math', math: true })
        if (node.value) state.addText(node.value as string)
        state.closeNode()
      }
    },
    toMarkdown: {
      match: base.toMarkdown.match,
      runner: (state, node) => {
        if (node.attrs.math && node.attrs.language === 'math') {
          state.addNode('math', undefined, node.textContent)
        } else {
          base.toMarkdown.runner(state, node)
        }
      }
    }
  }
})

/** Inline math source in text: Pandoc's rule (no space inside the `$`s, no digit after). */
const MATH_SOURCE = /(?<![\\$])\$(?![\s$])([^$\n]*?[^\s$\\])\$(?![\d$])/g

/** Typing the closing `$` of `$x^2$` turns it into rendered math. */
export const mathInlineInputRule = $inputRule(
  (ctx) =>
    new InputRule(/(?<![\\$])\$(?![\s$])([^$\n]*?[^\s$\\])\$$/, (state, match, start, end) => {
      const $start = state.doc.resolve(start)
      if ($start.parent.type.spec.code) return null
      if ($start.marks().some((m) => m.type.spec.code)) return null
      const node = mathInlineSchema.type(ctx).create({ value: match[1] })
      return state.tr.replaceWith(start, end, node)
    })
)

/** `$$` followed by a space starts a display-math block (Enter works too; see below). */
export const mathBlockInputRule = $inputRule((ctx) =>
  textblockTypeInputRule(/^\$\$\s$/, mathBlockSchema.type(ctx), { language: 'math', math: true })
)

const mathEditingKey = new PluginKey<DecorationSet>('math-editing')

interface SourceSpan {
  from: number
  to: number
  tex: string
}

/** `$…$` math source in plain text of the textblock starting at `blockPos`. */
function sourceSpans(doc: Node, blockPos: number): SourceSpan[] {
  const block = doc.nodeAt(blockPos)
  if (!block?.isTextblock || block.type.spec.code) return []
  const spans: SourceSpan[] = []
  block.forEach((child, offset) => {
    if (!child.isText || child.marks.some((m) => m.type.spec.code)) return
    const text = child.text!
    MATH_SOURCE.lastIndex = 0
    for (let m = MATH_SOURCE.exec(text); m; m = MATH_SOURCE.exec(text)) {
      const from = blockPos + 1 + offset + m.index
      spans.push({ from, to: from + m[0].length, tex: m[1] })
    }
  })
  return spans
}

const blockStart = (state: EditorState, pos: number): number | null => {
  const $pos = state.doc.resolve(Math.min(pos, state.doc.content.size))
  return $pos.parent.isTextblock ? $pos.before() : null
}

/**
 * Keeps inline math rendered except where it is being edited:
 * - selecting a rendered formula (clicking it) replaces it with its `$…$` source;
 * - source the caret is not in, in the blocks the caret was or is in, is rendered again.
 */
export const inlineMathEditing = $prose((ctx) => {
  return new Plugin<DecorationSet>({
    key: mathEditingKey,
    appendTransaction(trs, oldState, newState) {
      if (trs.some((tr) => tr.getMeta('composition') !== undefined || tr.getMeta(mathEditingKey))) {
        return null
      }
      const type = mathInlineSchema.type(ctx)
      const { selection } = newState
      let tr: Transaction | null = null

      if (selection instanceof NodeSelection && selection.node.type === type) {
        const value = selection.node.attrs.value as string
        tr = newState.tr.replaceWith(
          selection.from,
          selection.to,
          newState.schema.text(`$${value}$`, selection.$from.marks())
        )
        tr.setSelection(TextSelection.create(tr.doc, selection.from + 1 + value.length))
      } else if (trs.some((t) => t.selectionSet || t.docChanged)) {
        const mapping = trs.reduce((pos, t) => t.mapping.map(pos), oldState.selection.head)
        const head = selection.head
        const blocks = new Set<number>()
        for (const pos of [mapping, head]) {
          const start = blockStart(newState, pos)
          if (start !== null) blocks.add(start)
        }
        const toRender = [...blocks]
          .flatMap((pos) => sourceSpans(newState.doc, pos))
          .filter((span) => !(selection.empty && head >= span.from && head <= span.to))
          .filter((span) => selection.empty || selection.to < span.from || selection.from > span.to)
          .sort((a, b) => b.from - a.from)
        if (toRender.length > 0) {
          tr = newState.tr
          for (const span of toRender) {
            const marks = newState.doc.resolve(span.from + 1).marks()
            tr.replaceWith(span.from, span.to, type.create({ value: span.tex }, null, marks))
          }
        }
      }
      // Showing or hiding source is presentation only: not an undo step.
      return tr?.setMeta(mathEditingKey, true).setMeta('addToHistory', false) ?? null
    },
    // While editing source, show the rendered formula in a floating preview below it. It
    // lives outside the editable text so it can't get in the way of the caret.
    view: (editorView) => {
      const preview = document.createElement('div')
      preview.className = 'md-math-preview'
      preview.setAttribute('aria-hidden', 'true')
      preview.hidden = true
      document.body.append(preview)
      let shownTex: string | null = null
      const update = (): void => {
        const span = editedSpan(editorView.state)
        if (!span || !editorView.hasFocus()) {
          preview.hidden = true
          return
        }
        if (span.tex !== shownTex) {
          preview.innerHTML = renderTex(span.tex, false)
          shownTex = span.tex
        }
        const start = editorView.coordsAtPos(span.from)
        const end = editorView.coordsAtPos(span.to)
        preview.hidden = false
        preview.style.left = `${Math.max(4, start.left)}px`
        preview.style.top = `${Math.max(start.bottom, end.bottom) + 6}px`
      }
      const scroller = editorView.dom.closest('.editor-scroll')
      scroller?.addEventListener('scroll', update, { passive: true })
      editorView.dom.addEventListener('blur', update)
      return {
        update,
        destroy: () => {
          scroller?.removeEventListener('scroll', update)
          editorView.dom.removeEventListener('blur', update)
          preview.remove()
        }
      }
    },
    props: {
      // Style source being edited as code.
      decorations(state) {
        const span = editedSpan(state)
        if (!span) return null
        return DecorationSet.create(state.doc, [
          Decoration.inline(span.from, span.to, { class: 'md-math-source' })
        ])
      }
    }
  })
})

/** The `$…$` source the caret is in, if any. */
function editedSpan(state: EditorState): SourceSpan | null {
  const { selection } = state
  if (!selection.empty) return null
  const start = blockStart(state, selection.head)
  if (start === null) return null
  return (
    sourceSpans(state.doc, start).find((s) => selection.head >= s.from && selection.head <= s.to) ??
    null
  )
}

/** Enter on a paragraph containing just `$$` starts a display-math block. */
export const mathBlockOnEnter = $prose(
  (ctx) =>
    new Plugin({
      props: {
        handleKeyDown(view, event) {
          if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey) return false
          const { $head, empty } = view.state.selection
          const parent = $head.parent
          if (!empty || parent.type.name !== 'paragraph' || parent.textContent !== '$$')
            return false
          const type = mathBlockSchema.type(ctx)
          const start = $head.before()
          const tr = view.state.tr
            .replaceWith(start, $head.after(), type.create({ language: 'math', math: true }))
            .scrollIntoView()
          tr.setSelection(TextSelection.create(tr.doc, start + 1))
          view.dispatch(tr)
          return true
        }
      }
    })
)

export const math = [
  remarkMathPlugin,
  mathInlineSchema,
  mathBlockSchema,
  mathInlineInputRule,
  mathBlockInputRule,
  inlineMathEditing,
  mathBlockOnEnter
].flat()
