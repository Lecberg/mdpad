import { promises as fs } from 'fs'
import { join } from 'path'
import type { TextFormat } from '../../shared/ipc-types'

// Crash recovery. While a window has unsaved changes, its renderer periodically sends the
// text it would save; it is kept as one JSON draft per window. A window that closes
// normally removes its draft, so drafts found at startup are from a crash.

export interface Draft {
  version: 1
  /** The document's file, or null for an untitled document. */
  path: string | null
  text: string
  format: TextFormat
  savedAt: string
}

export class RecoveryStore {
  /** Per-draft operation chains, so a late write can never land after a discard. */
  private readonly queues = new Map<string, Promise<void>>()

  constructor(private readonly dir: string) {}

  private file(id: string): string {
    return join(this.dir, `${id}.json`)
  }

  private enqueue(id: string, task: () => Promise<void>): Promise<void> {
    const next = (this.queues.get(id) ?? Promise.resolve()).then(task).catch((error) => {
      console.error('recovery:', error)
    })
    this.queues.set(id, next)
    return next
  }

  write(id: string, draft: Omit<Draft, 'version' | 'savedAt'>): Promise<void> {
    return this.enqueue(id, async () => {
      await fs.mkdir(this.dir, { recursive: true })
      const data: Draft = { version: 1, ...draft, savedAt: new Date().toISOString() }
      const tmp = `${this.file(id)}.tmp`
      await fs.writeFile(tmp, JSON.stringify(data), 'utf8')
      await fs.rename(tmp, this.file(id))
    })
  }

  discard(id: string): Promise<void> {
    return this.enqueue(id, () => fs.rm(this.file(id), { force: true }))
  }

  /** Drafts left on disk, oldest first. Unreadable files are skipped. */
  async list(): Promise<Array<{ id: string; draft: Draft }>> {
    let names: string[]
    try {
      names = await fs.readdir(this.dir)
    } catch {
      return []
    }
    const drafts: Array<{ id: string; draft: Draft }> = []
    for (const name of names.filter((n) => n.endsWith('.json'))) {
      try {
        const draft = JSON.parse(await fs.readFile(join(this.dir, name), 'utf8')) as Draft
        if (draft.version === 1 && typeof draft.text === 'string') {
          drafts.push({ id: name.slice(0, -'.json'.length), draft })
        }
      } catch {
        // ignore corrupt drafts
      }
    }
    return drafts.sort((a, b) => a.draft.savedAt.localeCompare(b.draft.savedAt))
  }
}
