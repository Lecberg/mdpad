import remarkFrontmatter from 'remark-frontmatter'
import { $nodeSchema, $remark } from '@milkdown/kit/utils'

// YAML front matter (`---` block at the top of a file). Milkdown has no support for it, so
// without this it would be parsed as a horizontal rule plus a paragraph and mangled. It is
// edited as plain text in a code-like block and written back verbatim.

// Options must be explicit: Milkdown would otherwise pass `{}`, which remark-frontmatter rejects.
export const remarkFrontmatterPlugin = $remark('remarkFrontmatter', () => remarkFrontmatter, [
  'yaml'
])

export const frontmatterSchema = $nodeSchema('frontmatter', () => ({
  content: 'text*',
  group: 'block',
  marks: '',
  code: true,
  defining: true,
  isolating: true,
  parseDOM: [{ tag: 'pre[data-type="frontmatter"]', preserveWhitespace: 'full' as const }],
  toDOM: () => [
    'pre',
    { 'data-type': 'frontmatter', class: 'frontmatter', spellcheck: 'false' },
    ['code', 0]
  ],
  parseMarkdown: {
    match: (node) => node.type === 'yaml',
    runner: (state, node, type) => {
      state.openNode(type)
      if (node.value) state.addText(node.value as string)
      state.closeNode()
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'frontmatter',
    runner: (state, node) => {
      state.addNode('yaml', undefined, node.textContent)
    }
  }
}))

export const frontmatter = [remarkFrontmatterPlugin, frontmatterSchema].flat()
