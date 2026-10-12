import { BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import { isMainCommand } from '../shared/commands'
import {
  IpcChannel,
  type DocStatus,
  type FolderSnapshot,
  type FsResult,
  type InitialDoc,
  type OpenResult,
  type RecentList,
  type SaveChoice,
  type SaveImageResult,
  type SaveResult,
  type SearchResult,
  type TextFormat
} from '../shared/ipc-types'
import type { Settings } from '../shared/settings'
import { services } from './appContext'
import { MARKDOWN_FILTERS } from './fileFilters'
import { createEntry, renameEntry, revealEntry, trashEntry } from './folderOps'
import { MAIN_COMMANDS } from './mainCommands'
import { refreshMenu } from './menu'
import { writeTextFile } from './services/fileService'
import { flattenFiles, searchFiles } from './services/folderService'
import { saveImageNextTo } from './services/imageService'
import {
  allowWrite,
  askToSaveSync,
  canWrite,
  getRecord,
  loadIntoWindow,
  openLinkTarget,
  updateStatus
} from './window'

/** Make the app follow new settings: native theme (dialogs, menus), menu shortcuts, windows. */
export function applySettings(settings: Settings): void {
  nativeTheme.themeSource = settings.theme
  refreshMenu()
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannel.settingsChanged, settings)
  }
}

const str = (value: unknown): value is string => typeof value === 'string'

export function registerIpc(): void {
  ipcMain.handle(IpcChannel.windowReady, (event): InitialDoc => {
    const record = getRecord(event.sender)
    if (!record) return { file: null, recoveredText: null }
    record.ready = true
    const initial = record.initial
    record.initial = { file: null, recoveredText: null }
    return initial
  })

  ipcMain.on(IpcChannel.windowClose, (event) => {
    const record = getRecord(event.sender)
    if (!record) return
    record.forceClose = true
    record.win.close()
  })

  ipcMain.on(IpcChannel.docStatus, (event, status: DocStatus) => {
    const record = getRecord(event.sender)
    if (record) updateStatus(record, status)
  })

  ipcMain.on(IpcChannel.mainCommand, (event, id: unknown) => {
    if (isMainCommand(id)) MAIN_COMMANDS[id](BrowserWindow.fromWebContents(event.sender))
  })

  ipcMain.handle(
    IpcChannel.fileSave,
    async (event, path: string, text: string, format: TextFormat): Promise<SaveResult> => {
      const record = getRecord(event.sender)
      if (!record || !canWrite(record, path)) {
        return { ok: false, error: 'This window is not allowed to write to that path.' }
      }
      try {
        await writeTextFile(path, text, format)
        return { ok: true }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.on(IpcChannel.fileOpenLink, (event, href: string) => {
    const record = getRecord(event.sender)
    if (record) void openLinkTarget(record.win, record.status.path, href)
  })

  ipcMain.handle(
    IpcChannel.imageSave,
    async (event, mimeType: string, bytes: Uint8Array): Promise<SaveImageResult> => {
      const record = getRecord(event.sender)
      const docPath = record?.status.path
      if (!record || !docPath || !canWrite(record, docPath)) {
        return { ok: false, error: 'Save the document before adding images.' }
      }
      try {
        return { ok: true, src: await saveImageNextTo(docPath, mimeType, bytes) }
      } catch (error) {
        return { ok: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.on(IpcChannel.draftWrite, (event, text: string, format: TextFormat) => {
    const record = getRecord(event.sender)
    if (record)
      void services().recovery.write(record.draftId, { path: record.status.path, text, format })
  })

  ipcMain.on(IpcChannel.draftDiscard, (event) => {
    const record = getRecord(event.sender)
    if (record) void services().recovery.discard(record.draftId)
  })

  ipcMain.handle(
    IpcChannel.fileSaveAsDialog,
    async (event, defaultPath: string | null): Promise<string | null> => {
      const record = getRecord(event.sender)
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!record || !win) return null
      const result = await dialog.showSaveDialog(win, {
        defaultPath: defaultPath ?? 'Untitled.md',
        filters: MARKDOWN_FILTERS
      })
      if (result.canceled || !result.filePath) return null
      allowWrite(record, result.filePath)
      return result.filePath
    }
  )

  // ---- Settings ----

  ipcMain.on(IpcChannel.settingsGetSync, (event) => {
    event.returnValue = services().settings.current
  })

  ipcMain.on(IpcChannel.settingsUpdate, (_event, patch: unknown) => {
    void services().settings.update(patch).then(applySettings)
  })

  ipcMain.on(IpcChannel.customCssOpen, () => void services().customCss.open())

  // ---- Folder mode ----

  ipcMain.handle(IpcChannel.folderGet, async (event): Promise<FolderSnapshot | null> => {
    const folder = getRecord(event.sender)?.folder
    return folder ? folder.current() : null
  })

  ipcMain.handle(
    IpcChannel.folderSearch,
    async (event, query: unknown, matchCase: unknown): Promise<SearchResult> => {
      const folder = getRecord(event.sender)?.folder
      if (!folder || !str(query) || !query) return { files: [], total: 0, truncated: false }
      const files = flattenFiles((await folder.current()).children)
      return searchFiles(files, query, matchCase === true)
    }
  )

  ipcMain.handle(IpcChannel.docOpenHere, async (event, path: unknown): Promise<OpenResult> => {
    const record = getRecord(event.sender)
    if (!record || !str(path)) return { kind: 'error', message: 'Invalid request.' }
    return loadIntoWindow(record, path)
  })

  ipcMain.handle(IpcChannel.askToSave, (event, name: unknown): SaveChoice => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win && str(name) ? askToSaveSync(win, name) : 'cancel'
  })

  ipcMain.handle(
    IpcChannel.entryCreate,
    async (event, parentDir: unknown, name: unknown, kind: unknown): Promise<FsResult> => {
      const record = getRecord(event.sender)
      if (!record || !str(parentDir) || !str(name) || (kind !== 'file' && kind !== 'dir')) {
        return { ok: false, error: 'Invalid request.' }
      }
      return createEntry(record, parentDir, name, kind)
    }
  )

  ipcMain.handle(
    IpcChannel.entryRename,
    async (event, path: unknown, newName: unknown): Promise<FsResult> => {
      const record = getRecord(event.sender)
      if (!record || !str(path) || !str(newName)) return { ok: false, error: 'Invalid request.' }
      return renameEntry(record, path, newName)
    }
  )

  ipcMain.handle(IpcChannel.entryTrash, async (event, path: unknown): Promise<FsResult> => {
    const record = getRecord(event.sender)
    if (!record || !str(path)) return { ok: false, error: 'Invalid request.' }
    return trashEntry(record, path)
  })

  ipcMain.on(IpcChannel.entryReveal, (event, path: unknown) => {
    const record = getRecord(event.sender)
    if (record && str(path)) revealEntry(record, path)
  })

  ipcMain.handle(IpcChannel.recentGet, (): RecentList => services().recent.current)
}
