import { BaseWindow, BrowserWindow, Menu, dialog, type MenuItemConstructorOptions } from 'electron'
import type { CommandId } from '../shared/commands'
import { createDocumentWindow, openFile, sendCommand } from './window'

export const MARKDOWN_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
  { name: 'All Files', extensions: ['*'] }
]

/** The window a menu click applies to: the one Electron reports, else the focused one. */
function targetWindow(win: BaseWindow | undefined): BrowserWindow | null {
  return win instanceof BrowserWindow ? win : BrowserWindow.getFocusedWindow()
}

/** Menu item that forwards a command to the window's renderer. Its id is the command id. */
function forward(
  label: string,
  id: CommandId,
  accelerator: string,
  extra: Partial<MenuItemConstructorOptions> = {}
): MenuItemConstructorOptions {
  return {
    id,
    label,
    accelerator,
    click: (_item, win) => {
      const target = targetWindow(win)
      if (target) sendCommand(target, id)
    },
    ...extra
  }
}

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

export function buildMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        {
          id: 'file.new',
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => createDocumentWindow()
        },
        {
          id: 'file.open',
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: (_item, win) => void showOpenDialog(targetWindow(win))
        },
        { type: 'separator' },
        forward('Save', 'file.save', 'CmdOrCtrl+S'),
        forward('Save As…', 'file.saveAs', 'CmdOrCtrl+Shift+S'),
        { type: 'separator' },
        {
          id: 'file.close',
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: (_item, win) => targetWindow(win)?.close()
        },
        { role: 'quit', label: 'Exit' }
      ]
    },
    {
      label: '&Edit',
      submenu: [
        // The editor's own keymap handles Ctrl+Z/Y so undo stays inside its history;
        // the menu only shows the shortcut and forwards clicks.
        forward('Undo', 'edit.undo', 'CmdOrCtrl+Z', { registerAccelerator: false }),
        forward('Redo', 'edit.redo', 'CmdOrCtrl+Y', { registerAccelerator: false }),
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle', label: 'Paste as Plain Text' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '&View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' }
      ]
    }
  ]
  return Menu.buildFromTemplate(template)
}
