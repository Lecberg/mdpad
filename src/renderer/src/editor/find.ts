import { useSyncExternalStore } from 'react'
import { Plugin, type EditorState } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import {
  SearchQuery,
  findNext,
  findPrev,
  replaceAll,
  replaceNext,
  search,
  setSearchState
} from 'prosemirror-search'

// Find & replace for the visual editor. The search itself (match highlighting, next/prev,
// replace) is prosemirror-search; this module holds the find bar's state and match counts.

export interface FindState {
  open: boolean
  showReplace: boolean
  query: string
  replacement: string
  caseSensitive: boolean
  regexp: boolean
  /** Total matches, and 1-based index of the selected match (0 if none is selected). */
  total: number
  current: number
  invalid: boolean
  /** Bumped to ask the find bar to focus and select its input. */
  focusRequest: number
}

let state: FindState = {
  open: false,
  showReplace: false,
  query: '',
  replacement: '',
  caseSensitive: false,
  regexp: false,
  total: 0,
  current: 0,
  invalid: false,
  focusRequest: 0
}
let view: EditorView | null = null
const listeners = new Set<() => void>()

function set(patch: Partial<FindState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

export function useFind(): FindState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state
  )
}

export const getFindState = (): FindState => state

function buildQuery(): SearchQuery {
  return new SearchQuery({
    search: state.query,
    replace: state.replacement,
    caseSensitive: state.caseSensitive,
    regexp: state.regexp
  })
}

/** Count matches and find which one (if any) is currently selected. */
export function countMatches(
  editorState: EditorState,
  query: SearchQuery
): { total: number; current: number } {
  if (!query.valid || !query.search) return { total: 0, current: 0 }
  const { from, to } = editorState.selection
  let total = 0
  let current = 0
  let pos = 0
  for (
    let match = query.findNext(editorState, pos);
    match;
    match = query.findNext(editorState, pos)
  ) {
    total++
    if (match.from === from && match.to === to) current = total
    pos = match.to > match.from ? match.to : match.to + 1
    if (total >= 10000) break
  }
  return { total, current }
}

function sync(): void {
  if (!view) return
  const query = buildQuery()
  view.dispatch(setSearchState(view.state.tr, query))
  set({ invalid: !!state.query && !query.valid, ...countMatches(view.state, query) })
}

export function openFind(editorView: EditorView, withReplace: boolean): void {
  view = editorView
  const { from, to, empty } = editorView.state.selection
  const selected = empty ? '' : editorView.state.doc.textBetween(from, to, ' ')
  const prefill = selected && !selected.includes('\n') && selected.length < 200 ? selected : null
  set({
    open: true,
    showReplace: withReplace || state.showReplace,
    query: prefill ?? state.query,
    focusRequest: state.focusRequest + 1
  })
  sync()
}

export function closeFind(): void {
  if (!state.open) return
  set({ open: false })
  if (view) {
    view.dispatch(setSearchState(view.state.tr, new SearchQuery({ search: '' })))
    view.focus()
  }
}

export function updateFind(
  patch: Partial<
    Pick<FindState, 'query' | 'replacement' | 'caseSensitive' | 'regexp' | 'showReplace'>
  >
): void {
  set(patch)
  sync()
}

function run(command: typeof findNext): void {
  if (!view || !state.query) return
  command(view.state, view.dispatch, view)
  set(countMatches(view.state, buildQuery()))
}

export const findNextMatch = (): void => run(findNext)
export const findPreviousMatch = (): void => run(findPrev)
export const replaceMatch = (): void => run(replaceNext)
export const replaceAllMatches = (): void => run(replaceAll)

/** prosemirror-search plus keeping the counts current while the document changes. */
export const findPlugins = [
  $prose(() => search()),
  $prose(
    () =>
      new Plugin({
        view: () => ({
          update: (editorView, prevState) => {
            if (!state.open || editorView !== view || editorView.state.doc.eq(prevState.doc)) return
            set(countMatches(editorView.state, buildQuery()))
          }
        })
      })
  )
]
