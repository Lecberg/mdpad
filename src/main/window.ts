import { BrowserWindow, dialog, shell, type WebContents } from 'electron'
import { basename, join, resolve } from 'path'
import { is } from '@electron-toolkit/utils'
import { IpcChannel, type DocStatus, type LoadedFile } from '../shared/ipc-types'
import type { CommandId } from '../shared/commands'
import { readTextFile } from './services/fileService'

interface WindowRecord {
  win: BrowserWindow
  status: DocStatus
  /** File to hand over when the renderer calls windowReady. */
  initialFile: LoadedFile | null
  /** The renderer has called windowReady and is listening for docLoad. */
  ready: boolean
  /** Skip the unsaved-changes prompt on the next close. */
  forceClose: boolean
  /** Paths this window may write to: files opened into it, or chosen in its Save As dialog. */
  writablePaths: Set<string>
}

const records = new Map<number, WindowRecord>()

const pathKey = (p: string): string => resolve(p).toLowerCase()

export function getRecord(contents: WebContents): WindowRecord | undefined {
  return records.get(contents.id)
}

export function allowWrite(record: WindowRecord, path: string): void {
  record.writablePaths.add(pathKey(path))
}

export function canWrite(record: WindowRecord, path: string): boolean {
  return record.writablePaths.has(pathKey(path))
}

export function sendCommand(win: BrowserWindow, id: CommandId, thenClose = false): void {
  win.webContents.send(IpcChannel.menuCommand, { id, thenClose })
}

export function createDocumentWindow(file: LoadedFile | null = null): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 480,
    minHeight: 360,
    show: false,
    title: 'mdpad',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  const id = win.webContents.id
  const record: WindowRecord = {
    win,
    status: { path: file?.path ?? null, dirty: false },
    initialFile: file,
    ready: false,
    forceClose: false,
    writablePaths: new Set()
  }
  if (file) allowWrite(record, file.path)
  records.set(id, record)

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => records.delete(id))

  win.on('close', (event) => {
    if (record.forceClose || !record.status.dirty) return
    event.preventDefault()
    const name = record.status.path ? basename(record.status.path) : 'Untitled'
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      title: 'mdpad',
      message: `Do you want to save the changes you made to ${name}?`,
      detail: "Your changes will be lost if you don't save them.",
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    })
    if (choice === 0) {
      sendCommand(win, 'file.save', true)
    } else if (choice === 1) {
      record.forceClose = true
      win.close()
    }
  })

  // Only http(s) links may leave the app; everything else is blocked.
  win.webContents.setWindowOpenHandler((details) => {
    if (/^https?:\/\//i.test(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/**
 * Open a file: focus the window that already has it, reuse `target` if it is an empty
 * untouched window, otherwise open a new window.
 */
export async function openFile(path: string, target?: BrowserWindow | null): Promise<void> {
  const key = pathKey(path)
  for (const record of records.values()) {
    if (record.status.path && pathKey(record.status.path) === key) {
      if (record.win.isMinimized()) record.win.restore()
      record.win.focus()
      return
    }
  }

  let file: LoadedFile
  try {
    file = await readTextFile(resolve(path))
  } catch (error) {
    dialog.showErrorBox('Could not open file', `${path}\n\n${(error as Error).message}`)
    return
  }

  const record = target ? records.get(target.webContents.id) : undefined
  if (record && !record.status.path && !record.status.dirty) {
    record.status = { path: file.path, dirty: false }
    allowWrite(record, file.path)
    if (record.ready) record.win.webContents.send(IpcChannel.docLoad, file)
    else record.initialFile = file
    record.win.focus()
    return
  }

  createDocumentWindow(file)
}
