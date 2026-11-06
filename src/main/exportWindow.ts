// Preferences for the hidden window that prints exported documents. A partition without
// the "persist:" prefix is in-memory, so remote images in an exported page cannot read or
// write the app's cookies and cache. Electron-free, so it can be unit-tested.

export const EXPORT_PARTITION = 'mdpad-export'

export function printWindowPreferences(): {
  partition: string
  sandbox: true
  contextIsolation: true
  javascript: false
} {
  return {
    partition: EXPORT_PARTITION,
    sandbox: true,
    contextIsolation: true,
    javascript: false
  }
}
