import { BaseWindow, BrowserWindow, Menu, dialog, type MenuItemConstructorOptions } from 'electron'
import { COMMANDS, HEADING_COMMANDS, type CommandId } from '../shared/commands'
import { createDocumentWindow, openFile, sendCommand } from './window'

export const MARKDOWN_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
  { name: 'All Files', extensions: ['*'] }
]

/** The window a menu click applies to: the one Electron reports, else the focused one. */
function targetWindow(win: BaseWindow | undefined): BrowserWindow | null {
  return win instanceof BrowserWindow ? win : BrowserWindow.getFocusedWindow()
}

/**
 * Menu item for a renderer command. The shortcut is only displayed: the renderer's keymap
 * handles the key itself, and the menu forwards clicks. Its id is the command id.
 */
function forward(id: CommandId): MenuItemConstructorOptions {
  const spec: { label: string; accelerator?: string } = COMMANDS[id]
  return {
    id,
    label: spec.label,
    accelerator: spec.accelerator,
    registerAccelerator: false,
    click: (_item, win) => {
      const target = targetWindow(win)
      if (target) sendCommand(target, id)
    }
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
        forward('file.save'),
        forward('file.saveAs'),
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
        forward('edit.undo'),
        forward('edit.redo'),
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
      label: '&Paragraph',
      submenu: [
        ...HEADING_COMMANDS.map(forward),
        { type: 'separator' },
        forward('paragraph.paragraph'),
        { type: 'separator' },
        forward('paragraph.quote'),
        forward('paragraph.orderedList'),
        forward('paragraph.bulletList'),
        forward('paragraph.codeBlock'),
        { type: 'separator' },
        forward('paragraph.horizontalRule')
      ]
    },
    {
      label: 'F&ormat',
      submenu: [
        forward('format.bold'),
        forward('format.italic'),
        forward('format.code'),
        { type: 'separator' },
        forward('format.link')
      ]
    },
    {
      label: '&View',
      submenu: [
        forward('view.sourceMode'),
        forward('view.outline'),
        { type: 'separator' },
        // Ctrl+0 is "Paragraph" (as in Typora), so zoom moves to Ctrl+Shift.
        { role: 'resetZoom', accelerator: 'CmdOrCtrl+Shift+0' },
        { role: 'zoomIn', accelerator: 'CmdOrCtrl+Shift+=' },
        { role: 'zoomOut', accelerator: 'CmdOrCtrl+Shift+-' },
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
