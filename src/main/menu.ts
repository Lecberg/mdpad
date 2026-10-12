import { BaseWindow, BrowserWindow, Menu, dialog, type MenuItemConstructorOptions } from 'electron'
import { basename } from 'path'
import {
  COMMANDS,
  HEADING_COMMANDS,
  isMainCommand,
  shortcutFor,
  type CommandId
} from '../shared/commands'
import { services } from './appContext'
import { MAIN_COMMANDS } from './mainCommands'
import { isFolderPath, openFile, openFolder, sendCommand } from './window'

/** The window a menu click applies to: the one Electron reports, else the focused one. */
function targetWindow(win: BaseWindow | undefined): BrowserWindow | null {
  return win instanceof BrowserWindow ? win : BrowserWindow.getFocusedWindow()
}

/**
 * Menu item for a command. The shortcut is only displayed: the renderer's keymap handles
 * the key itself (so user-defined shortcuts and tests work the same), and the menu runs or
 * forwards clicks. Its id is the command id.
 */
function command(id: CommandId): MenuItemConstructorOptions {
  return {
    id,
    label: COMMANDS[id].label,
    accelerator: shortcutFor(id, services().settings.current.shortcuts),
    registerAccelerator: false,
    click: (_item, win) => {
      const target = targetWindow(win)
      if (isMainCommand(id)) MAIN_COMMANDS[id](target)
      else if (target) sendCommand(target, id)
    }
  }
}

/** "&" marks a mnemonic in Windows menu labels; paths must show it literally. */
const menuLabel = (text: string): string => text.replace(/&/g, '&&')

async function openRecentFolder(path: string, win: BrowserWindow | null): Promise<void> {
  if (await isFolderPath(path)) {
    openFolder(path, win)
    return
  }
  dialog.showErrorBox('Could not open folder', `${path}\n\nThe folder no longer exists.`)
  void services().recent.remove(path)
}

function recentMenu(): MenuItemConstructorOptions[] {
  const { files, folders } = services().recent.current
  const items: MenuItemConstructorOptions[] = files.map((path) => ({
    label: menuLabel(path),
    click: (_item, win) => void openFile(path, targetWindow(win))
  }))
  if (folders.length > 0) {
    if (items.length > 0) items.push({ type: 'separator' })
    for (const path of folders) {
      items.push({
        label: menuLabel(`${basename(path)}  —  ${path}`),
        click: (_item, win) => void openRecentFolder(path, targetWindow(win))
      })
    }
  }
  if (items.length === 0) items.push({ label: 'No Recent Files', enabled: false })
  items.push(
    { type: 'separator' },
    {
      id: 'file.clearRecent',
      label: 'Clear Recently Opened',
      enabled: files.length + folders.length > 0,
      click: () => void services().recent.clear()
    }
  )
  return items
}

export function buildMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        command('file.new'),
        { type: 'separator' },
        command('file.open'),
        command('file.openFolder'),
        { id: 'file.openRecent', label: 'Open Recent', submenu: recentMenu() },
        command('file.quickOpen'),
        { type: 'separator' },
        command('file.save'),
        command('file.saveAs'),
        { type: 'separator' },
        command('file.closeFolder'),
        command('file.close'),
        { type: 'separator' },
        command('file.preferences'),
        { type: 'separator' },
        { role: 'quit', label: 'Exit' }
      ]
    },
    {
      label: '&Edit',
      submenu: [
        command('edit.undo'),
        command('edit.redo'),
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle', label: 'Paste as Plain Text' },
        { type: 'separator' },
        { role: 'selectAll' },
        { type: 'separator' },
        command('edit.find'),
        command('edit.replace'),
        command('view.search')
      ]
    },
    {
      label: '&Paragraph',
      submenu: [
        ...HEADING_COMMANDS.map(command),
        { type: 'separator' },
        command('paragraph.paragraph'),
        { type: 'separator' },
        command('paragraph.quote'),
        command('paragraph.orderedList'),
        command('paragraph.bulletList'),
        command('paragraph.codeBlock'),
        command('paragraph.table'),
        { type: 'separator' },
        command('paragraph.horizontalRule')
      ]
    },
    {
      label: 'F&ormat',
      submenu: [
        command('format.bold'),
        command('format.italic'),
        command('format.code'),
        command('format.strikethrough'),
        { type: 'separator' },
        command('format.link')
      ]
    },
    {
      label: '&View',
      submenu: [
        command('view.sourceMode'),
        { type: 'separator' },
        command('view.toggleSidebar'),
        command('view.outline'),
        command('view.files'),
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

/** Rebuild the menu after shortcuts or the recent list changed. */
export function refreshMenu(): void {
  Menu.setApplicationMenu(buildMenu())
}
