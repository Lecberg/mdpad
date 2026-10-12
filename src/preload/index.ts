import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannel,
  type FolderSnapshot,
  type LoadedFile,
  type MdpadApi,
  type MenuCommandEvent
} from '../shared/ipc-types'
import type { Settings } from '../shared/settings'

// The preload runs sandboxed: it may only import 'electron' and must stay dependency-free
// (type-only imports and the inlined IpcChannel constants are fine).

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: MdpadApi = {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  windowReady: () => ipcRenderer.invoke(IpcChannel.windowReady),
  closeWindow: () => ipcRenderer.send(IpcChannel.windowClose),
  reportDocStatus: (status) => ipcRenderer.send(IpcChannel.docStatus, status),
  saveFile: (path, text, format) => ipcRenderer.invoke(IpcChannel.fileSave, path, text, format),
  showSaveAsDialog: (defaultPath) => ipcRenderer.invoke(IpcChannel.fileSaveAsDialog, defaultPath),
  openLinkTarget: (href) => ipcRenderer.send(IpcChannel.fileOpenLink, href),
  saveImage: (mimeType, bytes) => ipcRenderer.invoke(IpcChannel.imageSave, mimeType, bytes),
  writeDraft: (text, format) => ipcRenderer.send(IpcChannel.draftWrite, text, format),
  discardDraft: () => ipcRenderer.send(IpcChannel.draftDiscard),
  onLoadFile: (callback) => subscribe<LoadedFile>(IpcChannel.docLoad, callback),
  onFileChanged: (callback) => subscribe<LoadedFile>(IpcChannel.fileChanged, callback),
  onMenuCommand: (callback) => subscribe<MenuCommandEvent>(IpcChannel.menuCommand, callback),
  runMainCommand: (id) => ipcRenderer.send(IpcChannel.mainCommand, id),

  // Read synchronously once, so the first paint already uses the right theme and fonts.
  initialSettings: ipcRenderer.sendSync(IpcChannel.settingsGetSync) as Settings,
  updateSettings: (patch) => ipcRenderer.send(IpcChannel.settingsUpdate, patch),
  onSettingsChanged: (callback) => subscribe<Settings>(IpcChannel.settingsChanged, callback),
  openCustomCss: () => ipcRenderer.send(IpcChannel.customCssOpen),

  getFolder: () => ipcRenderer.invoke(IpcChannel.folderGet),
  onFolderChanged: (callback) =>
    subscribe<FolderSnapshot | null>(IpcChannel.folderChanged, callback),
  searchFolder: (query, matchCase) => ipcRenderer.invoke(IpcChannel.folderSearch, query, matchCase),
  openInWindow: (path) => ipcRenderer.invoke(IpcChannel.docOpenHere, path),
  askToSave: (name) => ipcRenderer.invoke(IpcChannel.askToSave, name),
  onDocRenamed: (callback) => subscribe<string>(IpcChannel.docRenamed, callback),
  createEntry: (parentDir, name, kind) =>
    ipcRenderer.invoke(IpcChannel.entryCreate, parentDir, name, kind),
  renameEntry: (path, newName) => ipcRenderer.invoke(IpcChannel.entryRename, path, newName),
  trashEntry: (path) => ipcRenderer.invoke(IpcChannel.entryTrash, path),
  revealInExplorer: (path) => ipcRenderer.send(IpcChannel.entryReveal, path),
  getRecent: () => ipcRenderer.invoke(IpcChannel.recentGet),
  exportDocument: (kind, html, defaultPath) =>
    ipcRenderer.invoke(IpcChannel.exportSave, kind, html, defaultPath)
}

contextBridge.exposeInMainWorld('api', api)
