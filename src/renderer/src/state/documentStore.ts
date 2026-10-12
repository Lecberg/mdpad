import { useSyncExternalStore } from 'react'
import type { LoadedFile, TextFormat } from '../../../shared/ipc-types'
import { ensureFinalNewline } from '../markdown/preserveFormatting'

export interface DocState {
  /** Changes whenever a different document is loaded; used to remount the editor. */
  loadId: number
  path: string | null
  /** LF-only text as last read from / written to disk. */
  original: string
  format: TextFormat & { finalNewline: boolean }
  /** Editor serialization of `original` (null until the editor has loaded it). */
  baseline: string | null
  /** Latest editor serialization. */
  current: string | null
  dirty: boolean
  /** The document changed but has not been re-serialized yet, so `dirty` may be stale. */
  changePending: boolean
  /** The editor would rewrite some syntax of `original` if those blocks get edited. */
  normalizes: boolean
  saving: boolean
  error: string | null
}

const NEW_DOC_FORMAT = { eol: '\n', bom: false, finalNewline: true } as const

let state: DocState = {
  loadId: 0,
  path: null,
  original: '',
  format: { ...NEW_DOC_FORMAT },
  baseline: null,
  current: null,
  dirty: false,
  changePending: false,
  normalizes: false,
  saving: false,
  error: null
}

const listeners = new Set<() => void>()

function set(patch: Partial<DocState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

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
      original: file.text,
      format: {
        eol: file.eol,
        bom: file.bom,
        finalNewline: file.text === '' || file.text.endsWith('\n')
      },
      baseline: null,
      current: null,
      dirty: false,
      changePending: false,
      normalizes: false,
      saving: false,
      error: null
    })
  },

  /** The editor finished loading `original` and serialized it as `markdown`. */
  editorReady(markdown: string): void {
    set({
      baseline: markdown,
      current: markdown,
      dirty: false,
      changePending: false,
      normalizes: markdown !== ensureFinalNewline(state.original)
    })
  },

  /** The document changed; its serialization will follow via editorChanged. */
  editorTouched(): void {
    if (state.baseline === null || state.changePending) return
    set({ changePending: true })
  },

  editorChanged(markdown: string): void {
    if (state.baseline === null) return
    set({ current: markdown, dirty: markdown !== state.baseline, changePending: false })
  },

  saveStarted(): void {
    set({ saving: true, error: null })
  },

  /** `written` is the LF text now on disk; `savedMarkdown` the serialization it came from. */
  saveSucceeded(path: string, written: string, savedMarkdown: string): void {
    set({
      path,
      original: written,
      baseline: savedMarkdown,
      dirty: state.current !== savedMarkdown,
      normalizes: savedMarkdown !== ensureFinalNewline(written),
      saving: false,
      error: null
    })
  },

  saveFailed(error: string): void {
    set({ saving: false, error })
  }
}

/**
 * Keep the main process's close guard up to date. Runs synchronously on every store change
 * (not in a React effect) and counts unserialized changes as dirty, so a close right after
 * a keystroke still prompts.
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
