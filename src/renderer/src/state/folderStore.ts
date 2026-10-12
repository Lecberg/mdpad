import type { FolderSnapshot, TreeNode } from '../../../shared/ipc-types'
import { ancestorsWithin, samePath } from '../lib/paths'
import { createStore } from './createStore'
import { uiStore } from './uiStore'

// The folder open in this window (folder mode) and which of its sub-folders are expanded.

export interface FolderState {
  folder: FolderSnapshot | null
  /** Lower-cased paths of expanded folders. */
  expanded: ReadonlySet<string>
}

export const folderStore = createStore<FolderState>({ folder: null, expanded: new Set() })

export const useFolder = (): FolderState => folderStore.use()

const key = (path: string): string => path.toLowerCase()

function setFolder(folder: FolderSnapshot | null): void {
  const previous = folderStore.get().folder
  const sameRoot = previous && folder && samePath(previous.root, folder.root)
  folderStore.set({ folder, expanded: sameRoot ? folderStore.get().expanded : new Set() })
  // Opening a folder shows its files; closing it leaves nothing for those tabs to show.
  if (folder && !sameRoot) uiStore.set({ sidebarOpen: true, sidebarTab: 'files' })
  if (!folder && uiStore.get().sidebarTab !== 'outline') uiStore.set({ sidebarTab: 'outline' })
}

export function startFolderSync(): () => void {
  void window.api.getFolder().then((folder) => {
    if (folder && !folderStore.get().folder) setFolder(folder)
  })
  return window.api.onFolderChanged(setFolder)
}

export const isExpanded = (state: FolderState, path: string): boolean =>
  state.expanded.has(key(path))

export function setExpanded(path: string, open: boolean): void {
  const expanded = new Set(folderStore.get().expanded)
  if (open) expanded.add(key(path))
  else expanded.delete(key(path))
  folderStore.set({ expanded })
}

/** Expand the folders containing `path` so it is visible in the tree. */
export function expandTo(path: string): void {
  const { folder, expanded } = folderStore.get()
  if (!folder) return
  const missing = ancestorsWithin(folder.root, path).filter((dir) => !expanded.has(key(dir)))
  if (missing.length === 0) return
  folderStore.set({ expanded: new Set([...expanded, ...missing.map(key)]) })
}

export function allFiles(nodes: TreeNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.kind === 'file') out.push(node.path)
    else if (node.children) allFiles(node.children, out)
  }
  return out
}
