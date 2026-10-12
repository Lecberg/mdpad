import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannel,
  type LoadedFile,
  type MdpadApi,
  type MenuCommandEvent
} from '../shared/ipc-types'

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
  onMenuCommand: (callback) => subscribe<MenuCommandEvent>(IpcChannel.menuCommand, callback)
}

contextBridge.exposeInMainWorld('api', api)
