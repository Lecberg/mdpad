import type { Options } from 'remark-stringify'

// How newly written Markdown looks. Untouched parts of a file keep their original syntax
// (see preserveFormatting.ts); these options only shape blocks the user edits.
export const STRINGIFY_OPTIONS: Options = {
  bullet: '-',
  emphasis: '*',
  strong: '*',
  rule: '-',
  fence: '`',
  fences: true,
  listItemIndent: 'one',
  setext: false
}
