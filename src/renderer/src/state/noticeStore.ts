import { useSyncExternalStore } from 'react'
import type { LoadedFile } from '../../../shared/ipc-types'

// A non-blocking message shown above the document that asks the user to decide something.

export type Notice =
  | {
      kind: 'recovered'
      /** The file as it is on disk, to go back to if the recovered text is discarded. */
      diskFile: LoadedFile | null
    }
  | {
      kind: 'externalChange'
      /** The new version written by another program. */
      file: LoadedFile
    }

let notice: Notice | null = null
const listeners = new Set<() => void>()

export const noticeStore = {
  get: (): Notice | null => notice,
  show(next: Notice | null): void {
    notice = next
    for (const listener of listeners) listener()
  },
  dismiss(): void {
    noticeStore.show(null)
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
}

export function useNotice(): Notice | null {
  return useSyncExternalStore(noticeStore.subscribe, noticeStore.get)
}
