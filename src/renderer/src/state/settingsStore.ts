import { DEFAULT_SETTINGS, type Settings } from '../../../shared/settings'
import { setShortcutOverrides } from '../commands/keymap'
import { createStore } from './createStore'

// The app-wide preferences (owned by the main process) and applying them to this window.

export const settingsStore = createStore<Settings>(DEFAULT_SETTINGS)

export const useSettings = (): Settings => settingsStore.use()

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function applyToDocument(settings: Settings): void {
  const root = document.documentElement
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && darkQuery.matches)
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.setProperty('--text-size', `${settings.fontSize}px`)
  root.style.setProperty('--text-width', `${settings.lineWidth}px`)
  if (settings.fontFamily) {
    root.style.setProperty('--font-text', `${settings.fontFamily}, var(--font-text-default)`)
  } else {
    root.style.removeProperty('--font-text')
  }
  setShortcutOverrides(settings.shortcuts)
}

/** Apply the window's initial settings, and follow later changes and the system theme. */
export function startSettings(): void {
  settingsStore.subscribe(() => applyToDocument(settingsStore.get()))
  settingsStore.set(window.api.initialSettings)
  window.api.onSettingsChanged((settings) => settingsStore.set(settings))
  darkQuery.addEventListener('change', () => applyToDocument(settingsStore.get()))
}

/** Change settings: applied here at once, then saved and shared by the main process. */
export function updateSettings(patch: Partial<Settings>): void {
  settingsStore.set(patch)
  window.api.updateSettings(patch)
}
