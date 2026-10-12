import { app, BrowserWindow, Menu } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { filesFromArgv } from './argv'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'
import { createDocumentWindow, openFile } from './window'

async function openFilesOrBlank(files: string[]): Promise<void> {
  if (files.length === 0) {
    createDocumentWindow()
    return
  }
  for (const file of files) await openFile(file)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // A second launch (e.g. double-clicking another .md file) hands its files to us.
  app.on('second-instance', (_event, argv, cwd) => {
    void openFilesOrBlank(filesFromArgv(argv, cwd))
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.mdpad.app')

    // F12 toggles DevTools in development; Ctrl+R reload is disabled in production.
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerIpc()
    Menu.setApplicationMenu(buildMenu())
    void openFilesOrBlank(filesFromArgv(process.argv, process.cwd()))
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createDocumentWindow()
  })
}
