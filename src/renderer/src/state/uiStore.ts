import { useSyncExternalStore } from 'react'

export interface UiState {
  sidebarOpen: boolean
  /** Scroll position (0–1) to restore after switching between visual and source mode. */
  pendingScrollRatio: number | null
}

let state: UiState = { sidebarOpen: false, pendingScrollRatio: null }
const listeners = new Set<() => void>()

export const uiStore = {
  get: (): UiState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  set(patch: Partial<UiState>): void {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }
}

export function useUi(): UiState {
  return useSyncExternalStore(uiStore.subscribe, uiStore.get)
}
