import type { Link } from 'mdast'
import { defaultHandlers, type Handle } from 'mdast-util-to-markdown'

// A link whose text is its own URL is written as a bare URL (GFM autolink literal), the
// way people type them in notes, instead of remark's default `<https://…>`. Only simple
// URLs qualify, so the bare form is guaranteed to parse back as the same link.

const SIMPLE_URL = /^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:[/?#][\w\-.~%!$&'+,;=:@/?#]*)?$/
const TRAILING_PUNCTUATION = /[.,:;!?'_)~-]$/

export function isBareUrlCandidate(link: Link): boolean {
  const only = link.children.length === 1 ? link.children[0] : null
  return (
    !link.title &&
    only?.type === 'text' &&
    only.value === link.url &&
    SIMPLE_URL.test(link.url) &&
    !TRAILING_PUNCTUATION.test(link.url)
  )
}

export const linkHandler: Handle = (node, parent, state, info) => {
  if (isBareUrlCandidate(node as Link)) return (node as Link).url
  return defaultHandlers.link(node as Link, parent, state, info)
}
