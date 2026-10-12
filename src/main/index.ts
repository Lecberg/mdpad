import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import type { InitialDoc } from '../shared/ipc-types'
import { setServices } from './appContext'
import { pathsFromArgv, type ArgvPaths } from './argv'
import { CustomCss } from './customCss'
import { registerIpc } from './ipc'
import { refreshMenu } from './menu'
import { handleLocalFiles, registerLocalFileScheme } from './protocol'
import { readTextFile } from './services/fileService'
import { RecentStore } from './services/recentService'
import { RecoveryStore } from './services/recoveryService'
import { SettingsStore } from './services/settingsService'
import { createDocumentWindow, openFile, openFolder } from './window'

// Tests (and anyone wanting a separate profile) can point the app at another data folder.
// This must happen before the single-instance lock, which is tied to the data folder.
if (process.env.MDPAD_USER_DATA) app.setPath('userData', process.env.MDPAD_USER_DATA)

registerLocalFileScheme()

const argvPaths = (argv: string[], cwd: string): ArgvPaths =>
  pathsFromArgv(argv, cwd, process.defaultApp ? app.getAppPath() : undefined)

async function openPathsOrBlank({ files, folders }: ArgvPaths): Promise<void> {
  if (files.length === 0 && folders.length === 0) {
    createDocumentWindow()
    return
  }
  for (const folder of folders) openFolder(folder)
  for (const file of files) await openFile(file)
}

/** Reopen documents that had unsaved changes when the app last crashed. */
async function restoreDrafts(recovery: RecoveryStore): Promise<number> {
  const drafts = await recovery.list()
  for (const { id, draft } of drafts) {
    let initial: InitialDoc = { file: null, recoveredText: draft.text }
    if (draft.path) {
      try {
        initial = { file: await readTextFile(draft.path), recoveredText: draft.text }
      } catch {
        // The file is gone: reopen with its path so saving recreates it.
        initial = {
          file: { path: draft.path, text: '', ...draft.format },
          recoveredText: draft.text
        }
      }
    }
    createDocumentWindow(initial)
    // The new window keeps its own draft from now on.
    await recovery.discard(id)
  }
  return drafts.length
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // A second launch (e.g. double-clicking another .md file) hands its files to us.
  app.on('second-instance', (_event, argv, cwd) => {
    void openPathsOrBlank(argvPaths(argv, cwd))
  })

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.mdpad.app')

    // F12 toggles DevTools in development; Ctrl+R reload is disabled in production.
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    const userData = app.getPath('userData')
    const settings = new SettingsStore(join(userData, 'settings.json'))
    const recent = new RecentStore(join(userData, 'recent.json'))
    const recovery = new RecoveryStore(join(userData, 'recovery'))
    const customCss = new CustomCss(join(userData, 'custom.css'))
    await Promise.all([settings.load(), recent.load(), customCss.load()])
    setServices({ settings, recent, recovery, customCss })
    nativeTheme.themeSource = settings.current.theme

    handleLocalFiles()
    registerIpc()
    refreshMenu()
    recent.onChange(refreshMenu)

    const restored = await restoreDrafts(recovery)

    const paths = argvPaths(process.argv, process.cwd())
    if (paths.files.length + paths.folders.length > 0 || restored === 0) {
      await openPathsOrBlank(paths)
    }
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createDocumentWindow()
  })
}
