import type { SearchResult } from '../../../shared/ipc-types'
import { createStore } from './createStore'

// Search across the open folder. Kept outside the panel so results survive switching tabs.

export interface SearchState {
  query: string
  matchCase: boolean
  result: SearchResult | null
  /** The query `result` belongs to. */
  resultQuery: string
  searching: boolean
}

export const searchStore = createStore<SearchState>({
  query: '',
  matchCase: false,
  result: null,
  resultQuery: '',
  searching: false
})

export const useSearch = (): SearchState => searchStore.use()

let timer: ReturnType<typeof setTimeout> | undefined
let sequence = 0

/** Change the query/options and search again after a short pause in typing. */
export function updateSearch(patch: Partial<Pick<SearchState, 'query' | 'matchCase'>>): void {
  searchStore.set(patch)
  clearTimeout(timer)
  const { query } = searchStore.get()
  if (!query) {
    sequence++
    searchStore.set({ result: null, resultQuery: '', searching: false })
    return
  }
  searchStore.set({ searching: true })
  timer = setTimeout(runSearch, 200)
}

export async function runSearch(): Promise<void> {
  const { query, matchCase } = searchStore.get()
  if (!query) return
  const id = ++sequence
  searchStore.set({ searching: true })
  const result = await window.api.searchFolder(query, matchCase)
  if (id !== sequence) return // a newer search started meanwhile
  searchStore.set({ result, resultQuery: query, searching: false })
}
