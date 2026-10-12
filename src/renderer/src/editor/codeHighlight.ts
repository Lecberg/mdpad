import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { tags } from '@lezer/highlight'

// Syntax colors for CodeMirror (source mode and code blocks), using the theme's tokens.
const highlightStyle = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '600', color: 'var(--color-heading)' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--color-link)' },
  { tag: tags.monospace, color: 'var(--color-code-text)' },
  {
    tag: [tags.processingInstruction, tags.meta, tags.contentSeparator],
    color: 'var(--color-muted)'
  },
  { tag: tags.quote, color: 'var(--color-muted)' },
  {
    tag: [tags.keyword, tags.modifier, tags.operatorKeyword],
    color: 'var(--color-syntax-keyword)'
  },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp],
    color: 'var(--color-syntax-string)'
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: 'var(--color-muted)',
    fontStyle: 'italic'
  },
  { tag: [tags.number, tags.bool, tags.atom, tags.null], color: 'var(--color-syntax-number)' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--color-syntax-function)'
  },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--color-syntax-type)' },
  { tag: [tags.tagName, tags.attributeName], color: 'var(--color-syntax-keyword)' },
  { tag: tags.invalid, color: 'var(--color-syntax-invalid)' }
])

export const codeHighlighting: Extension = syntaxHighlighting(highlightStyle)
