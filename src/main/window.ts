import { BrowserWindow, dialog, nativeTheme, shell, type WebContents } from 'electron'
import { randomUUID } from 'crypto'
import { stat } from 'fs/promises'
import { basename, dirname, join, resolve } from 'path'
import { is } from '@electron-toolkit/utils'
import {
  IpcChannel,
  type DocStatus,
  type FolderSnapshot,
  type InitialDoc,
  type LoadedFile,
  type OpenResult
} from '../shared/ipc-types'
import type { CommandId } from '../shared/commands'
import { services } from './appContext'
import { FolderSession } from './folderSession'
import { readTextFile } from './services/fileService'
import { watchFile } from './services/fileWatcher'
import { isInsideFolder, isMarkdownPath } from './services/folderService'

export interface WindowRecord {
  win: BrowserWindow
  status: DocStatus
  /** What to hand over when the renderer calls windowReady. */
  initial: InitialDoc
  /** The renderer has called windowReady and is listening for docLoad. */
  ready: boolean
  /** Skip the unsaved-changes prompt on the next close. */
  forceClose: boolean
  /** Paths this window may write to: files opened into it, or chosen in its Save As dialog. */
  writablePaths: Set<string>
  /** Id of this window's crash-recovery draft. */
  draftId: string
  /** Stops watching the document file for outside changes. */
  unwatch: () => void
  /** The folder shown in this window's file tree. */
  folder: FolderSession | null
}

const records = new Map<number, WindowRecord>()

export const pathKey = (p: string): string => resolve(p).toLowerCase()

export const allRecords = (): IterableIterator<WindowRecord> => records.values()

/** Window background before the page paints, matching the theme to avoid a white flash. */
const backgroundColor = (): string => (nativeTheme.shouldUseDarkColors ? '#1f2125' : '#ffffff')

/** Record the window's document state; (re)start watching when the path changes. */
export function updateStatus(record: WindowRecord, status: DocStatus): void {
  const pathChanged =
    (status.path && pathKey(status.path)) !== (record.status.path && pathKey(record.status.path))
  record.status = status
  if (pathChanged || !status.path) watchDocument(record)
  if (pathChanged && status.path) void services().recent.addFile(status.path)
}

function watchDocument(record: WindowRecord): void {
  record.unwatch()
  record.unwatch = () => {}
  const path = record.status.path
  if (!path) return
  record.unwatch = watchFile(path, () => {
    readTextFile(path)
      .then((file) => {
        if (!record.win.isDestroyed()) record.win.webContents.send(IpcChannel.fileChanged, file)
      })
      .catch(() => {}) // deleted or unreadable: keep the open document as is
  })
}

export function getRecord(contents: WebContents): WindowRecord | undefined {
  return records.get(contents.id)
}

export function recordOf(win: BrowserWindow): WindowRecord | undefined {
  return records.get(win.webContents.id)
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

function send(record: WindowRecord, channel: string, payload: unknown): void {
  if (!record.win.isDestroyed()) record.win.webContents.send(channel, payload)
}

/** Show `root` in the window's file tree (or close its folder when null). */
export function setWindowFolder(record: WindowRecord, root: string | null): void {
  record.folder?.dispose()
  record.folder = null
  if (!root) {
    send(record, IpcChannel.folderChanged, null)
    return
  }
  const session = new FolderSession(resolve(root), (snapshot: FolderSnapshot) =>
    send(record, IpcChannel.folderChanged, snapshot)
  )
  record.folder = session
  void session.refresh()
  void services().recent.addFolder(session.root)
}

export function createDocumentWindow(
  initial: InitialDoc = { file: null, recoveredText: null },
  folder: string | null = null
): BrowserWindow {
  const file = initial.file
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 480,
    minHeight: 360,
    show: false,
    title: 'mdpad',
    backgroundColor: backgroundColor(),
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
    status: { path: null, dirty: false },
    initial,
    ready: false,
    forceClose: false,
    writablePaths: new Set(),
    draftId: randomUUID(),
    unwatch: () => {},
    folder: null
  }
  if (file) {
    allowWrite(record, file.path)
    updateStatus(record, { path: file.path, dirty: initial.recoveredText !== null })
  }
  records.set(id, record)
  if (folder) setWindowFolder(record, folder)

  win.on('ready-to-show', () => win.show())
  // A normal close (saved, or "Don't Save") means the draft is no longer needed. After a
  // crash this never runs, which is what leaves drafts behind for recovery.
  win.on('closed', () => {
    record.unwatch()
    record.folder?.dispose()
    void services().recovery.discard(record.draftId)
    services().customCss.forget(id)
    records.delete(id)
  })

  win.on('close', (event) => {
    if (record.forceClose || !record.status.dirty) return
    event.preventDefault()
    const name = record.status.path ? basename(record.status.path) : 'Untitled'
    const choice = askToSaveSync(win, name)
    if (choice === 'save') {
      sendCommand(win, 'file.save', true)
    } else if (choice === 'discard') {
      record.forceClose = true
      win.close()
    }
  })

  // Only web and mail links may leave the app; everything else is blocked.
  win.webContents.setWindowOpenHandler((details) => {
    if (/^(https?:\/\/|mailto:)/i.test(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  win.webContents.on('did-finish-load', () => void services().customCss.apply(win.webContents))

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

export function askToSaveSync(win: BrowserWindow, name: string): 'save' | 'discard' | 'cancel' {
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
  return choice === 0 ? 'save' : choice === 1 ? 'discard' : 'cancel'
}

/**
 * Open a relative link from a document. Markdown/text files open in the app; anything else
 * is only revealed in Explorer (never executed, since links come from document content).
 */
export async function openLinkTarget(
  win: BrowserWindow,
  docPath: string | null,
  href: string
): Promise<void> {
  if (!docPath) {
    dialog.showMessageBox(win, {
      type: 'info',
      message: 'Save this document first to open relative links.'
    })
    return
  }
  let target: string
  try {
    target = resolve(dirname(docPath), decodeURIComponent(href.split('#')[0]))
  } catch {
    return
  }
  let isFile = false
  try {
    isFile = (await stat(target)).isFile()
  } catch {
    // reported below
  }
  if (!isFile) {
    dialog.showMessageBox(win, { type: 'warning', message: `File not found:\n${target}` })
  } else if (isMarkdownPath(target)) {
    await openFile(target)
  } else {
    shell.showItemInFolder(target)
  }
}

/** The window that already shows `path`, if any (other than `except`). */
function windowWithFile(path: string, except?: WindowRecord): WindowRecord | undefined {
  const key = pathKey(path)
  for (const record of records.values()) {
    if (record !== except && record.status.path && pathKey(record.status.path) === key) {
      return record
    }
  }
  return undefined
}

function focus(record: WindowRecord): void {
  if (record.win.isMinimized()) record.win.restore()
  record.win.focus()
}

/**
 * Open a file: focus the window that already has it, reuse `target` if it is an empty
 * untouched window, otherwise open a new window.
 */
export async function openFile(path: string, target?: BrowserWindow | null): Promise<void> {
  const existing = windowWithFile(path)
  if (existing) {
    focus(existing)
    return
  }

  let file: LoadedFile
  try {
    file = await readTextFile(resolve(path))
  } catch (error) {
    dialog.showErrorBox('Could not open file', `${path}\n\n${(error as Error).message}`)
    void services().recent.remove(path)
    return
  }

  const record = target ? records.get(target.webContents.id) : undefined
  if (record && !record.status.path && !record.status.dirty) {
    updateStatus(record, { path: file.path, dirty: false })
    allowWrite(record, file.path)
    if (record.ready) record.win.webContents.send(IpcChannel.docLoad, file)
    else record.initial = { file, recoveredText: null }
    focus(record)
    return
  }

  createDocumentWindow({ file, recoveredText: null })
}

/**
 * Load a file the renderer picked (file tree, quick open, search) into this window, replacing
 * its document; the renderer has already dealt with unsaved changes. Only files in the
 * window's folder or the recent list may be opened this way.
 */
export async function loadIntoWindow(record: WindowRecord, path: string): Promise<OpenResult> {
  const full = resolve(path)
  const allowed =
    isMarkdownPath(full) &&
    ((record.folder && isInsideFolder(record.folder.root, full)) ||
      services().recent.current.files.some((p) => pathKey(p) === pathKey(full)))
  if (!allowed) return { kind: 'error', message: 'This file can’t be opened from here.' }

  const existing = windowWithFile(full, record)
  if (existing) {
    focus(existing)
    return { kind: 'elsewhere' }
  }
  let file: LoadedFile
  try {
    file = await readTextFile(full)
  } catch (error) {
    void services().recent.remove(full)
    return { kind: 'error', message: (error as Error).message }
  }
  allowWrite(record, file.path)
  updateStatus(record, { path: file.path, dirty: false })
  return { kind: 'loaded', file }
}

/**
 * Open a folder: in `target` if given (File > Open Folder), else in a window already showing
 * it, else in an empty untouched window, else in a new window.
 */
export function openFolder(root: string, target?: BrowserWindow | null): void {
  const record = target ? records.get(target.webContents.id) : undefined
  if (record) {
    setWindowFolder(record, root)
    focus(record)
    return
  }
  const key = pathKey(root)
  for (const r of records.values()) {
    if (r.folder && pathKey(r.folder.root) === key) {
      focus(r)
      return
    }
  }
  for (const r of records.values()) {
    if (!r.folder && !r.status.path && !r.status.dirty) {
      setWindowFolder(r, root)
      focus(r)
      return
    }
  }
  createDocumentWindow(undefined, root)
}

/** After a file or folder was renamed/moved, point open documents at their new paths. */
export function documentsMoved(from: string, to: string): void {
  const prefix = pathKey(from)
  for (const record of records.values()) {
    const path = record.status.path
    if (!path) continue
    const key = pathKey(path)
    if (key !== prefix && !key.startsWith(prefix + '\\') && !key.startsWith(prefix + '/')) continue
    const moved = join(to, resolve(path).slice(resolve(from).length))
    allowWrite(record, moved)
    send(record, IpcChannel.docRenamed, moved)
  }
}

export const isFolderPath = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}
