// Text this app has just written, so the directory watcher can tell its own saves apart
// from changes made by another program. A short per-path history (rather than one value)
// keeps back-to-back saves matchable even when watcher events arrive after a later save.

interface Entry {
  text: string
  at: number
}

export class PendingWrites {
  private readonly byPath = new Map<string, Entry[]>()

  constructor(
    private readonly ttlMs = 5000,
    private readonly maxPerPath = 8
  ) {}

  note(key: string, text: string, now = Date.now()): void {
    const entries = this.prune(key, now)
    entries.push({ text, at: now })
    if (entries.length > this.maxPerPath) entries.splice(0, entries.length - this.maxPerPath)
    this.byPath.set(key, entries)
  }

  /** Whether `text` is what this app recently wrote to `key`. Does not consume the entry. */
  matches(key: string, text: string, now = Date.now()): boolean {
    return this.prune(key, now).some((entry) => entry.text === text)
  }

  /** Remove one matching entry (a write that failed and will not reach the watcher). */
  forget(key: string, text: string, now = Date.now()): void {
    const entries = this.prune(key, now)
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].text !== text) continue
      entries.splice(i, 1)
      break
    }
    if (entries.length === 0) this.byPath.delete(key)
  }

  clearPath(key: string): void {
    this.byPath.delete(key)
  }

  private prune(key: string, now: number): Entry[] {
    const entries = this.byPath.get(key) ?? []
    const fresh = entries.filter((entry) => now - entry.at <= this.ttlMs)
    if (fresh.length === 0) this.byPath.delete(key)
    else this.byPath.set(key, fresh)
    return fresh
  }
}
