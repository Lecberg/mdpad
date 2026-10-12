// Single source of truth for the API the preload script exposes as `window.api`.
// Main-process handlers, the preload bridge, and the renderer all import from here.

import type { CommandId } from './commands'

export interface RuntimeVersions {
  electron: string
  chrome: string
  node: string
}

/** On-disk text format details, detected on read and reproduced on write. */
export interface TextFormat {
  eol: '\n' | '\r\n'
  bom: boolean
}

/** A file as handed to the renderer: `text` always uses LF line endings and has no BOM. */
export interface LoadedFile extends TextFormat {
  path: string
  text: string
}

/** What a new window starts with. */
export interface InitialDoc {
  file: LoadedFile | null
  /** Unsaved text recovered after a crash; shown instead of the file's text. */
  recoveredText: string | null
}

export type SaveResult = { ok: true } | { ok: false; error: string }
export type SaveImageResult = { ok: true; src: string } | { ok: false; error: string }

/** What the main process needs to know about a window's document. */
export interface DocStatus {
  path: string | null
  dirty: boolean
}

export interface MenuCommandEvent {
  id: CommandId
  /** Set when the main process asks for a save as part of closing the window. */
  thenClose?: boolean
}

export const IpcChannel = {
  windowReady: 'window:ready',
  windowClose: 'window:close',
  docStatus: 'doc:status',
  docLoad: 'doc:load',
  fileSave: 'file:save',
  fileSaveAsDialog: 'file:save-as-dialog',
  fileOpenLink: 'file:open-link',
  fileChanged: 'file:changed',
  imageSave: 'image:save',
  draftWrite: 'draft:write',
  draftDiscard: 'draft:discard',
  menuCommand: 'menu:command'
} as const

export interface MdpadApi {
  versions: RuntimeVersions
  /** Called once on startup; resolves to what this window should show. */
  windowReady(): Promise<InitialDoc>
  /** Close this window without the unsaved-changes prompt (after a successful save). */
  closeWindow(): void
  reportDocStatus(status: DocStatus): void
  saveFile(path: string, text: string, format: TextFormat): Promise<SaveResult>
  showSaveAsDialog(defaultPath: string | null): Promise<string | null>
  /** Open a relative link target (resolved against this window's document folder). */
  openLinkTarget(href: string): void
  /** Save an image next to this window's (saved) document; returns its relative src. */
  saveImage(mimeType: string, bytes: Uint8Array): Promise<SaveImageResult>
  /** Keep a crash-recovery copy of the text this window would save. */
  writeDraft(text: string, format: TextFormat): void
  discardDraft(): void
  /** Subscribe to files the main process loads into this window. Returns an unsubscribe fn. */
  onLoadFile(callback: (file: LoadedFile) => void): () => void
  /** Subscribe to changes of this window's file made by other programs. */
  onFileChanged(callback: (file: LoadedFile) => void): () => void
  onMenuCommand(callback: (event: MenuCommandEvent) => void): () => void
}
