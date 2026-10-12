import { watch, type FSWatcher } from 'fs'
import type { FolderSnapshot } from '../shared/ipc-types'
import { isSkippedName, scanFolder } from './services/folderService'

/**
 * A folder open in a window: its current listing, kept up to date by watching the folder
 * (recursively, which Windows supports natively) and rescanning after changes settle.
 */
export class FolderSession {
  private snapshot: FolderSnapshot | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private watcher: FSWatcher | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private disposed = false

  constructor(
    readonly root: string,
    private readonly onUpdate: (snapshot: FolderSnapshot) => void,
    private readonly delayMs = 200
  ) {
    try {
      this.watcher = watch(root, { recursive: true }, (_event, filename) => {
        // Changes inside hidden folders (.git) or node_modules don't affect the tree.
        const parts = filename ? filename.toString().split(/[\\/]/) : []
        if (parts.some(isSkippedName)) return
        clearTimeout(this.timer)
        this.timer = setTimeout(() => void this.refresh(), this.delayMs)
      })
      this.watcher.on('error', () => this.watcher?.close())
    } catch {
      // Unwatchable (e.g. a network drive): the tree still updates after our own changes.
    }
  }

  /** The latest listing, scanning first if there is none yet. */
  current(): Promise<FolderSnapshot> {
    return this.snapshot ? Promise.resolve(this.snapshot) : this.refresh()
  }

  /** Rescan now; listeners hear about it only if something changed. */
  refresh(): Promise<FolderSnapshot> {
    const run = this.queue.then(async () => {
      const next = await scanFolder(this.root)
      const changed = JSON.stringify(next) !== JSON.stringify(this.snapshot)
      this.snapshot = next
      if (changed && !this.disposed) this.onUpdate(next)
      return next
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  dispose(): void {
    this.disposed = true
    clearTimeout(this.timer)
    this.watcher?.close()
  }
}
