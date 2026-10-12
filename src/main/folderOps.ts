import { dialog, shell } from 'electron'
import { promises as fs } from 'fs'
import { basename, dirname, join, resolve } from 'path'
import type { FsResult } from '../shared/ipc-types'
import { invalidNameReason, isInsideFolder, isMarkdownPath } from './services/folderService'
import { allowWrite, documentsMoved, pathKey, type WindowRecord } from './window'

// File-tree operations requested by a window's renderer. Every path must be inside that
// window's open folder; the folder itself can't be renamed or deleted from the tree.

const errorMessage = (error: unknown): string => (error as Error).message

function checkInside(record: WindowRecord, path: string, allowRoot: boolean): string | null {
  const root = record.folder?.root
  if (!root || !isInsideFolder(root, path)) return 'That item isn’t in the open folder.'
  if (!allowRoot && pathKey(path) === pathKey(root))
    return 'The open folder itself can’t be changed.'
  return null
}

export async function createEntry(
  record: WindowRecord,
  parentDir: string,
  name: string,
  kind: 'file' | 'dir'
): Promise<FsResult> {
  const problem = checkInside(record, parentDir, true) ?? invalidNameReason(name)
  if (problem) return { ok: false, error: problem }
  if (kind === 'file' && !isMarkdownPath(name)) {
    return { ok: false, error: 'New files must be Markdown files (.md).' }
  }
  const path = join(resolve(parentDir), name)
  try {
    if (kind === 'dir') await fs.mkdir(path)
    else await fs.writeFile(path, '', { flag: 'wx' })
  } catch (error) {
    const exists = (error as NodeJS.ErrnoException).code === 'EEXIST'
    return { ok: false, error: exists ? `“${name}” already exists.` : errorMessage(error) }
  }
  if (kind === 'file') allowWrite(record, path)
  await record.folder?.refresh()
  return { ok: true, path }
}

export async function renameEntry(
  record: WindowRecord,
  path: string,
  newName: string
): Promise<FsResult> {
  const problem = checkInside(record, path, false) ?? invalidNameReason(newName)
  if (problem) return { ok: false, error: problem }
  const from = resolve(path)
  const to = join(dirname(from), newName)
  if (to === from) return { ok: true, path: to }
  // A change of letter case only is allowed even though Windows sees the same file.
  if (pathKey(to) !== pathKey(from)) {
    const exists = await fs.stat(to).then(
      () => true,
      () => false
    )
    if (exists) return { ok: false, error: `“${newName}” already exists.` }
  }
  try {
    await fs.rename(from, to)
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
  documentsMoved(from, to)
  await record.folder?.refresh()
  return { ok: true, path: to }
}

export async function trashEntry(record: WindowRecord, path: string): Promise<FsResult> {
  const problem = checkInside(record, path, false)
  if (problem) return { ok: false, error: problem }
  const full = resolve(path)
  const isDir = await fs.stat(full).then(
    (info) => info.isDirectory(),
    () => false
  )
  const choice = dialog.showMessageBoxSync(record.win, {
    type: 'question',
    title: 'mdpad',
    message: `Move “${basename(full)}” to the Recycle Bin?`,
    detail: isDir ? 'The folder and everything in it will be moved.' : undefined,
    buttons: ['Move to Recycle Bin', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })
  if (choice !== 0) return { ok: false }
  try {
    await shell.trashItem(full)
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
  await record.folder?.refresh()
  return { ok: true, path: full }
}

export function revealEntry(record: WindowRecord, path: string): void {
  if (!checkInside(record, path, true)) shell.showItemInFolder(resolve(path))
}
