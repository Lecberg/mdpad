import { resolve } from 'path'
import type { RecentList } from '../../shared/ipc-types'
import { readJson, writeJsonAtomic, WriteQueue } from './jsonFile'

const MAX_ITEMS = 12

const key = (path: string): string => resolve(path).toLowerCase()

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string').slice(0, MAX_ITEMS)
}

/** Recently opened files and folders (newest first), kept in userData/recent.json. */
export class RecentStore {
  private list: RecentList = { files: [], folders: [] }
  private readonly writes = new WriteQueue()
  private readonly listeners = new Set<() => void>()

  constructor(private readonly path: string) {}

  get current(): RecentList {
    return this.list
  }

  async load(): Promise<void> {
    const raw = (await readJson(this.path)) as Partial<RecentList> | undefined
    this.list = { files: cleanList(raw?.files), folders: cleanList(raw?.folders) }
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  addFile(path: string): Promise<void> {
    return this.change({ files: withFirst(this.list.files, path) })
  }

  addFolder(path: string): Promise<void> {
    return this.change({ folders: withFirst(this.list.folders, path) })
  }

  remove(path: string): Promise<void> {
    const k = key(path)
    return this.change({
      files: this.list.files.filter((p) => key(p) !== k),
      folders: this.list.folders.filter((p) => key(p) !== k)
    })
  }

  clear(): Promise<void> {
    return this.change({ files: [], folders: [] })
  }

  private change(patch: Partial<RecentList>): Promise<void> {
    const next = { ...this.list, ...patch }
    if (JSON.stringify(next) === JSON.stringify(this.list)) return Promise.resolve()
    this.list = next
    for (const listener of this.listeners) listener()
    return this.writes.run(() => writeJsonAtomic(this.path, next))
  }
}

function withFirst(list: string[], path: string): string[] {
  const k = key(path)
  return [resolve(path), ...list.filter((p) => key(p) !== k)].slice(0, MAX_ITEMS)
}
