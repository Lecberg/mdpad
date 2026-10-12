import { useSyncExternalStore } from 'react'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { docInfoStore } from '../state/docInfoStore'
import { markRangeAt } from './markRange'

// Link editing (Ctrl+K and clicking a revealed link URL) and link opening (Ctrl+click).

export interface LinkEditorState {
  open: boolean
  /** Document range the link covers (equal when inserting a new link at the caret). */
  from: number
  to: number
  href: string
  /** Viewport coordinates for the popover. */
  top: number
  left: number
}

let state: LinkEditorState = { open: false, from: 0, to: 0, href: '', top: 0, left: 0 }
let view: EditorView | null = null
const listeners = new Set<() => void>()

function set(next: LinkEditorState): void {
  state = next
  for (const listener of listeners) listener()
}

export function useLinkEditor(): LinkEditorState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state
  )
}

/** Open the link popover for the link at the caret, or for the selection. */
export function openLinkEditor(editorView: EditorView): boolean {
  const { selection, schema } = editorView.state
  const range = markRangeAt(selection.$head, schema.marks.link)
  const target = range
    ? { from: range.from, to: range.to, href: range.mark.attrs.href as string }
    : { from: selection.from, to: selection.to, href: '' }
  const coords = editorView.coordsAtPos(target.from)
  view = editorView
  set({ open: true, ...target, top: coords.bottom + 6, left: coords.left })
  return true
}

export function closeLinkEditor(refocus = true): void {
  if (!state.open) return
  set({ ...state, open: false })
  if (refocus) view?.focus()
}

/** Apply the popover's URL: set, change, insert, or (when empty) remove the link. */
export function applyLink(rawHref: string): void {
  if (!view || !state.open) return
  const href = rawHref.trim()
  const { from, to } = state
  const linkType = view.state.schema.marks.link
  const tr = view.state.tr
  if (!href) {
    if (from < to) tr.removeMark(from, to, linkType)
  } else if (from === to) {
    tr.insertText(href, from)
    tr.addMark(from, from + href.length, linkType.create({ href }))
    tr.setSelection(TextSelection.create(tr.doc, from + href.length))
  } else {
    tr.removeMark(from, to, linkType).addMark(from, to, linkType.create({ href }))
  }
  view.dispatch(tr)
  closeLinkEditor()
}

/** Heading anchor slug: lowercase, spaces to hyphens, punctuation dropped (CJK kept). */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

/** Open a link target: web/mail links externally, #anchors in place, files via the app. */
export function openHref(href: string, scrollToHeading: (target: number) => void): void {
  if (/^(https?:|mailto:)/i.test(href)) {
    window.open(href)
  } else if (href.startsWith('#')) {
    const anchor = slugify(decodeURIComponent(href.slice(1)))
    const heading = docInfoStore.get().outline.find((item) => slugify(item.text) === anchor)
    if (heading) scrollToHeading(heading.target)
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    window.api.openLinkTarget(href)
  }
}
