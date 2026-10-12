import { createStore } from './createStore'

export type SidebarTab = 'files' | 'outline' | 'search'

/** A search result to show once its file is loaded: select that match in the editor. */
export interface Reveal {
  query: string
  matchCase: boolean
  /** 1-based line and 0-based column in the file text (used in source mode). */
  line: number
  column: number
  /** Index of the match among the file's matches (used in visual mode). */
  occurrence: number
}

export interface UiState {
  sidebarOpen: boolean
  sidebarTab: SidebarTab
  /** Bumped to ask the search panel to focus its input. */
  searchFocusRequest: number
  quickOpenOpen: boolean
  settingsOpen: boolean
  /** Scroll position (0–1) to restore after switching between visual and source mode. */
  pendingScrollRatio: number | null
  pendingReveal: Reveal | null
}

export const uiStore = createStore<UiState>({
  sidebarOpen: false,
  sidebarTab: 'outline',
  searchFocusRequest: 0,
  quickOpenOpen: false,
  settingsOpen: false,
  pendingScrollRatio: null,
  pendingReveal: null
})

export const useUi = (): UiState => uiStore.use()

/** Show a sidebar tab; asking for the tab that is already showing hides the sidebar. */
export function toggleSidebarTab(tab: SidebarTab): void {
  const { sidebarOpen, sidebarTab } = uiStore.get()
  if (sidebarOpen && sidebarTab === tab) uiStore.set({ sidebarOpen: false })
  else uiStore.set({ sidebarOpen: true, sidebarTab: tab })
}
