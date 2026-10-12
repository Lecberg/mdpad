import { BrowserWindow, dialog } from 'electron'
import type { MainCommandId } from '../shared/commands'
import { MARKDOWN_FILTERS } from './fileFilters'
import { createDocumentWindow, openFile, openFolder, recordOf, setWindowFolder } from './window'

// Commands carried out by the main process. The menu runs them directly; keyboard
// shortcuts arrive from the renderer's keymap over IPC.

async function showOpenDialog(win: BrowserWindow | null): Promise<void> {
  const options = {
    properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
    filters: MARKDOWN_FILTERS
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled) return
  for (const path of result.filePaths) await openFile(path, win)
}

async function showOpenFolderDialog(win: BrowserWindow | null): Promise<void> {
  const options = { properties: ['openDirectory'] as Array<'openDirectory'> }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (!result.canceled && result.filePaths[0]) openFolder(result.filePaths[0], win)
}

export const MAIN_COMMANDS: Record<MainCommandId, (win: BrowserWindow | null) => void> = {
  'file.new': () => createDocumentWindow(),
  'file.open': (win) => void showOpenDialog(win),
  'file.openFolder': (win) => void showOpenFolderDialog(win),
  'file.closeFolder': (win) => {
    const record = win && recordOf(win)
    if (record) setWindowFolder(record, null)
  },
  'file.close': (win) => win?.close()
}
