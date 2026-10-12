// Single source of truth for the API the preload script exposes as `window.api`.
// Main-process handlers, the preload bridge, and the renderer all import from here.

import type { CommandId, MainCommandId } from './commands'
import type { Settings } from './settings'

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

/** A folder or Markdown file in an open folder. */
export interface TreeNode {
  name: string
  path: string
  kind: 'dir' | 'file'
  children?: TreeNode[]
}

/** The Markdown files and folders inside a window's open folder. */
export interface FolderSnapshot {
  root: string
  children: TreeNode[]
  /** The folder is very large and only part of it is listed. */
  truncated: boolean
}

export interface SearchMatch {
  /** 1-based line and 0-based column of the match in the file's text. */
  line: number
  column: number
  /** 0-based index of this match among all matches in the file. */
  occurrence: number
  /** The line (shortened around the match), and where the match is inside it. */
  preview: string
  previewStart: number
  previewEnd: number
}

export interface SearchFileResult {
  path: string
  matches: SearchMatch[]
}

export interface SearchResult {
  files: SearchFileResult[]
  total: number
  /** There were more matches than the result lists. */
  truncated: boolean
}

export type OpenResult =
  | { kind: 'loaded'; file: LoadedFile }
  /** The file is already open in another window, which was brought to the front. */
  | { kind: 'elsewhere' }
  | { kind: 'error'; message: string }

/** Result of a file-tree operation; neither `path` nor `error` means the user cancelled. */
export type FsResult = { ok: true; path: string } | { ok: false; error?: string }

export type SaveChoice = 'save' | 'discard' | 'cancel'

export interface RecentList {
  files: string[]
  folders: string[]
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
  menuCommand: 'menu:command',
  mainCommand: 'main:command',
  settingsGetSync: 'settings:get-sync',
  settingsUpdate: 'settings:update',
  settingsChanged: 'settings:changed',
  customCssOpen: 'settings:open-custom-css',
  folderGet: 'folder:get',
  folderChanged: 'folder:changed',
  folderSearch: 'folder:search',
  docOpenHere: 'doc:open-here',
  docRenamed: 'doc:renamed',
  askToSave: 'doc:ask-to-save',
  entryCreate: 'entry:create',
  entryRename: 'entry:rename',
  entryTrash: 'entry:trash',
  entryReveal: 'entry:reveal',
  recentGet: 'recent:get'
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
  /** Ask the main process to carry out a command (new window, open dialogs, close). */
  runMainCommand(id: MainCommandId): void

  /** Settings at the time this window was created; later changes arrive via onSettingsChanged. */
  initialSettings: Settings
  updateSettings(patch: Partial<Settings>): void
  onSettingsChanged(callback: (settings: Settings) => void): () => void
  /** Create (if needed) and open the user's custom CSS file. */
  openCustomCss(): void

  /** The folder open in this window, if any. */
  getFolder(): Promise<FolderSnapshot | null>
  onFolderChanged(callback: (folder: FolderSnapshot | null) => void): () => void
  searchFolder(query: string, matchCase: boolean): Promise<SearchResult>
  /** Load a file from this window's folder (or the recent list) into this window. */
  openInWindow(path: string): Promise<OpenResult>
  /** Ask whether to save changes to `name` before it is replaced. */
  askToSave(name: string): Promise<SaveChoice>
  /** This window's document file was renamed or moved (e.g. from the file tree). */
  onDocRenamed(callback: (path: string) => void): () => void
  createEntry(parentDir: string, name: string, kind: 'file' | 'dir'): Promise<FsResult>
  renameEntry(path: string, newName: string): Promise<FsResult>
  /** Move a file or folder to the Recycle Bin, after asking. */
  trashEntry(path: string): Promise<FsResult>
  revealInExplorer(path: string): void
  getRecent(): Promise<RecentList>
}
