import { useSyncExternalStore } from 'react'
import type { InitialDoc, LoadedFile, TextFormat } from '../../../shared/ipc-types'
import { ensureFinalNewline } from '../markdown/preserveFormatting'

export type EditorMode = 'wysiwyg' | 'source'

export interface DocState {
  /** Changes whenever an editor must be (re)mounted with new content. */
  loadId: number
  path: string | null
  format: TextFormat
  /** LF-only text as last read from / written to disk. */
  diskText: string
  mode: EditorMode

  // Visual mode
  /** Text the visual editor was loaded from; the merge base for saving (see saveText.ts). */
  original: string
  /** Editor serialization of `original` (null until the editor has loaded it). */
  baseline: string | null
  /** Latest editor serialization. */
  current: string | null
  /** The editor would rewrite some syntax of `original` if those blocks get edited. */
  normalizes: boolean

  // Source mode
  /** Latest source text (source mode only). */
  sourceText: string

  dirty: boolean
  /** The document changed but has not been re-read yet, so `dirty` may be stale. */
  changePending: boolean
  saving: boolean
  error: string | null
}

let state: DocState = {
  loadId: 0,
  path: null,
  format: { eol: '\n', bom: false },
  diskText: '',
  mode: 'wysiwyg',
  original: '',
  baseline: null,
  current: null,
  normalizes: false,
  sourceText: '',
  dirty: false,
  changePending: false,
  saving: false,
  error: null
}

const listeners = new Set<() => void>()

function set(patch: Partial<DocState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

const visualDirty = (original: string, baseline: string | null, current: string | null): boolean =>
  original !== state.diskText || (baseline !== null && current !== baseline)

export const documentStore = {
  get: (): DocState => state,

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  load(file: LoadedFile): void {
    set({
      loadId: state.loadId + 1,
      path: file.path,
      format: { eol: file.eol, bom: file.bom },
      diskText: file.text,
      original: file.text,
      baseline: null,
      current: null,
      normalizes: false,
      sourceText: file.text,
      dirty: false,
      changePending: false,
      saving: false,
      error: null
    })
  },

  /**
   * Show what a new window was opened with: a file, and/or text recovered after a crash
   * (which then differs from the disk, so the document starts out dirty).
   */
  loadInitial(initial: InitialDoc): void {
    if (initial.file) documentStore.load(initial.file)
    if (initial.recoveredText === null) return
    const text = initial.recoveredText
    set({
      loadId: state.loadId + 1,
      original: text,
      baseline: null,
      current: null,
      sourceText: text,
      dirty: text !== state.diskText,
      changePending: false
    })
  },

  /** The file changed on disk but the user keeps their version: compare against the new text. */
  acceptDiskText(text: string): void {
    const dirty =
      state.mode === 'source'
        ? state.sourceText !== text
        : state.original !== text || (state.baseline !== null && state.current !== state.baseline)
    set({ diskText: text, dirty })
  },

  /** The file was renamed or moved (e.g. from the file tree); the content is unchanged. */
  renamed(path: string): void {
    set({ path })
  },

  /** Back to an empty untitled document (e.g. discarding a recovered one). */
  reset(): void {
    set({
      loadId: state.loadId + 1,
      path: null,
      format: { eol: '\n', bom: false },
      diskText: '',
      original: '',
      baseline: null,
      current: null,
      normalizes: false,
      sourceText: '',
      dirty: false,
      changePending: false,
      saving: false,
      error: null
    })
  },

  /** The visual editor finished loading `original` and serialized it as `markdown`. */
  editorReady(markdown: string): void {
    set({
      baseline: markdown,
      current: markdown,
      changePending: false,
      dirty: state.original !== state.diskText,
      normalizes: markdown !== ensureFinalNewline(state.original)
    })
  },

  /** The document changed; its new content will follow via editorChanged/sourceChanged. */
  touched(): void {
    if (state.changePending) return
    if (state.mode === 'wysiwyg' && state.baseline === null) return
    set({ changePending: true })
  },

  editorChanged(markdown: string): void {
    if (state.mode !== 'wysiwyg' || state.baseline === null) return
    set({
      current: markdown,
      dirty: visualDirty(state.original, state.baseline, markdown),
      changePending: false
    })
  },

  sourceChanged(text: string): void {
    if (state.mode !== 'source') return
    set({ sourceText: text, dirty: text !== state.diskText, changePending: false })
  },

  /** Switch to source mode showing `text` (what saving would write right now). */
  enterSource(text: string): void {
    set({
      mode: 'source',
      loadId: state.loadId + 1,
      sourceText: text,
      dirty: text !== state.diskText,
      changePending: false
    })
  },

  /** Back to visual mode; the source text becomes the visual editor's merge base. */
  exitSource(): void {
    set({
      mode: 'wysiwyg',
      loadId: state.loadId + 1,
      original: state.sourceText,
      baseline: null,
      current: null,
      dirty: state.sourceText !== state.diskText,
      changePending: false
    })
  },

  saveStarted(): void {
    set({ saving: true, error: null })
  },

  /**
   * `written` is the LF text now on disk. In visual mode, `savedMarkdown` is the editor
   * serialization it was produced from.
   */
  saveSucceeded(path: string, written: string, savedMarkdown: string | null): void {
    const common = { path, diskText: written, saving: false, error: null }
    if (state.mode === 'source') {
      set({ ...common, dirty: state.sourceText !== written })
      return
    }
    const baseline = savedMarkdown ?? state.baseline
    set({
      ...common,
      original: written,
      baseline,
      dirty: state.current !== baseline,
      normalizes: baseline !== null && baseline !== ensureFinalNewline(written)
    })
  },

  saveFailed(error: string): void {
    set({ saving: false, error })
  }
}

/**
 * Keep the main process's close guard up to date. Runs synchronously on every store change
 * (not in a React effect) and counts unread changes as dirty, so a close right after a
 * keystroke still prompts.
 */
export function reportStatusToMain(): void {
  let last = ''
  const report = (): void => {
    const status = { path: state.path, dirty: state.dirty || state.changePending }
    const key = JSON.stringify(status)
    if (key === last) return
    last = key
    window.api.reportDocStatus(status)
  }
  documentStore.subscribe(report)
  report()
}

export function useDocument(): DocState {
  return useSyncExternalStore(documentStore.subscribe, documentStore.get)
}
