import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  IpcChannel,
  type DocStatus,
  type InitialDoc,
  type SaveImageResult,
  type SaveResult,
  type TextFormat
} from '../shared/ipc-types'
import { MARKDOWN_FILTERS } from './menu'
import { writeTextFile } from './services/fileService'
import { saveImageNextTo } from './services/imageService'
import {
  allowWrite,
  canWrite,
  getRecord,
  getRecoveryStore,
  openLinkTarget,
  updateStatus
} from './window'

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
      void getRecoveryStore()?.write(record.draftId, { path: record.status.path, text, format })
  })

  ipcMain.on(IpcChannel.draftDiscard, (event) => {
    const record = getRecord(event.sender)
    if (record) void getRecoveryStore()?.discard(record.draftId)
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
}
