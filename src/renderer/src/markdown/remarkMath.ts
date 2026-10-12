import type { Root, Text } from 'mdast'
import { mathFromMarkdown, mathToMarkdown, type InlineMath } from 'mdast-util-math'
import { math } from 'micromark-extension-math'
import type { Processor } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

// Math: `$inline$` and `$$ display $$` (remark-math syntax, as in Typora).
//
// Two deliberate differences from plain remark-math, so documents that merely mention
// money don't turn into formulas:
// - Inline math follows Pandoc's rule: the content may not start or end with whitespace,
//   and the closing `$` may not be followed by a digit. "$5 and $10" stays text.
// - When writing, a lone `$` in text is not escaped (only `$$` is). Text that the strict
//   rule left as text is written back unchanged instead of becoming "\$5 and \$10".

/** Inline math that Pandoc's rule would not accept, given the source it was parsed from. */
export function isLooseInlineMath(node: InlineMath, source: string): boolean {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (start === undefined || end === undefined) return false
  const raw = source.slice(start, end)
  if (raw.startsWith('$$')) return false // `$$…$$` inside a line is always math
  // Check the source, not node.value: the parser strips a space on each side (as for code).
  const inner = raw.slice(1, -1)
  return /^\s|\s$/.test(inner) || /^\d/.test(source.slice(end, end + 1))
}

/** Turn loose inline math back into the text it was written as. */
export function rejectLooseInlineMath(tree: Root, source: string): void {
  visit(tree, 'inlineMath', (node, index, parent) => {
    if (!parent || index === undefined || !isLooseInlineMath(node, source)) return
    const raw = source.slice(node.position!.start.offset, node.position!.end.offset)
    const text: Text = { type: 'text', value: raw, position: node.position }
    parent.children.splice(index, 1, text)
    return [SKIP, index + 1]
  })
}

type DataLists = {
  micromarkExtensions?: unknown[]
  fromMarkdownExtensions?: unknown[]
  toMarkdownExtensions?: unknown[]
}

export default function remarkMath(
  this: Processor
): (tree: Root, file: { value: unknown }) => void {
  const data = this.data() as DataLists
  const toMarkdown = mathToMarkdown({ singleDollarTextMath: true })
  toMarkdown.unsafe = (toMarkdown.unsafe ?? []).map((pattern) =>
    pattern.character === '$' && pattern.inConstruct === 'phrasing'
      ? { ...pattern, after: '\\$' }
      : pattern
  )
  ;(data.micromarkExtensions ??= []).push(math({ singleDollarTextMath: true }))
  ;(data.fromMarkdownExtensions ??= []).push(mathFromMarkdown())
  ;(data.toMarkdownExtensions ??= []).push(toMarkdown)
  return (tree, file) => rejectLooseInlineMath(tree, String(file.value ?? ''))
}
