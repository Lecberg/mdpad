import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  IpcChannel,
  type DocStatus,
  type LoadedFile,
  type SaveResult,
  type TextFormat
} from '../shared/ipc-types'
import { MARKDOWN_FILTERS } from './menu'
import { writeTextFile } from './services/fileService'
import { allowWrite, canWrite, getRecord } from './window'

export function registerIpc(): void {
  ipcMain.handle(IpcChannel.windowReady, (event): LoadedFile | null => {
    const record = getRecord(event.sender)
    if (!record) return null
    record.ready = true
    const file = record.initialFile
    record.initialFile = null
    return file
  })

  ipcMain.on(IpcChannel.windowClose, (event) => {
    const record = getRecord(event.sender)
    if (!record) return
    record.forceClose = true
    record.win.close()
  })

  ipcMain.on(IpcChannel.docStatus, (event, status: DocStatus) => {
    const record = getRecord(event.sender)
    if (record) record.status = status
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
}
