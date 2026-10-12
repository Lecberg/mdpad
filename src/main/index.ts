import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import type { InitialDoc } from '../shared/ipc-types'
import { filesFromArgv } from './argv'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'
import { handleLocalFiles, registerLocalFileScheme } from './protocol'
import { readTextFile } from './services/fileService'
import { RecoveryStore } from './services/recoveryService'
import { createDocumentWindow, openFile, setRecoveryStore } from './window'

// Tests (and anyone wanting a separate profile) can point the app at another data folder.
// This must happen before the single-instance lock, which is tied to the data folder.
if (process.env.MDPAD_USER_DATA) app.setPath('userData', process.env.MDPAD_USER_DATA)

registerLocalFileScheme()

async function openFilesOrBlank(files: string[]): Promise<void> {
  if (files.length === 0) {
    createDocumentWindow()
    return
  }
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
    void openFilesOrBlank(filesFromArgv(argv, cwd))
  })

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.mdpad.app')

    // F12 toggles DevTools in development; Ctrl+R reload is disabled in production.
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    handleLocalFiles()
    registerIpc()
    Menu.setApplicationMenu(buildMenu())

    const recovery = new RecoveryStore(join(app.getPath('userData'), 'recovery'))
    setRecoveryStore(recovery)
    const restored = await restoreDrafts(recovery)

    const files = filesFromArgv(process.argv, process.cwd())
    if (files.length > 0 || restored === 0) await openFilesOrBlank(files)
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createDocumentWindow()
  })
}
