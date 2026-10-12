// Commands handled by the renderer. The native menu shows these labels and shortcuts and
// forwards clicks; the renderer's own keymap (renderer/src/commands/keymap.ts) handles the
// keyboard shortcuts, so they work identically from the menu, the keyboard, and in tests.
// Accelerators use Electron's syntax; users can override them in Preferences.
// Commands marked `main` are carried out by the main process (windows, dialogs); the
// renderer's keymap forwards those to it.

interface CommandSpec {
  label: string
  accelerator?: string
  main?: true
}

export const COMMANDS = {
  'file.new': { label: 'New', accelerator: 'CmdOrCtrl+N', main: true },
  'file.open': { label: 'Open…', accelerator: 'CmdOrCtrl+O', main: true },
  'file.openFolder': { label: 'Open Folder…', main: true },
  'file.closeFolder': { label: 'Close Folder', main: true },
  'file.quickOpen': { label: 'Quick Open…', accelerator: 'CmdOrCtrl+P' },
  'file.save': { label: 'Save', accelerator: 'CmdOrCtrl+S' },
  'file.saveAs': { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S' },
  'file.preferences': { label: 'Preferences…', accelerator: 'CmdOrCtrl+,' },
  'file.close': { label: 'Close', accelerator: 'CmdOrCtrl+W', main: true },

  'edit.undo': { label: 'Undo', accelerator: 'CmdOrCtrl+Z' },
  'edit.redo': { label: 'Redo', accelerator: 'CmdOrCtrl+Y' },
  'edit.find': { label: 'Find…', accelerator: 'CmdOrCtrl+F' },
  'edit.replace': { label: 'Replace…', accelerator: 'CmdOrCtrl+H' },

  'paragraph.heading1': { label: 'Heading 1', accelerator: 'CmdOrCtrl+1' },
  'paragraph.heading2': { label: 'Heading 2', accelerator: 'CmdOrCtrl+2' },
  'paragraph.heading3': { label: 'Heading 3', accelerator: 'CmdOrCtrl+3' },
  'paragraph.heading4': { label: 'Heading 4', accelerator: 'CmdOrCtrl+4' },
  'paragraph.heading5': { label: 'Heading 5', accelerator: 'CmdOrCtrl+5' },
  'paragraph.heading6': { label: 'Heading 6', accelerator: 'CmdOrCtrl+6' },
  'paragraph.paragraph': { label: 'Paragraph', accelerator: 'CmdOrCtrl+0' },
  'paragraph.quote': { label: 'Quote', accelerator: 'CmdOrCtrl+Shift+Q' },
  'paragraph.orderedList': { label: 'Ordered List', accelerator: 'CmdOrCtrl+Shift+[' },
  'paragraph.bulletList': { label: 'Unordered List', accelerator: 'CmdOrCtrl+Shift+]' },
  'paragraph.codeBlock': { label: 'Code Block', accelerator: 'CmdOrCtrl+Shift+K' },
  'paragraph.table': { label: 'Table', accelerator: 'CmdOrCtrl+T' },
  'paragraph.horizontalRule': { label: 'Horizontal Line' },

  'format.bold': { label: 'Bold', accelerator: 'CmdOrCtrl+B' },
  'format.italic': { label: 'Italic', accelerator: 'CmdOrCtrl+I' },
  'format.code': { label: 'Inline Code', accelerator: 'CmdOrCtrl+Shift+`' },
  'format.strikethrough': { label: 'Strikethrough', accelerator: 'Alt+Shift+5' },
  'format.link': { label: 'Link', accelerator: 'CmdOrCtrl+K' },

  'view.sourceMode': { label: 'Source Code Mode', accelerator: 'CmdOrCtrl+/' },
  'view.toggleSidebar': { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+Shift+L' },
  'view.outline': { label: 'Outline', accelerator: 'CmdOrCtrl+Shift+1' },
  'view.files': { label: 'Files', accelerator: 'CmdOrCtrl+Shift+3' },
  'view.search': { label: 'Search in Folder…', accelerator: 'CmdOrCtrl+Shift+F' }
} as const satisfies Record<string, CommandSpec>

export type CommandId = keyof typeof COMMANDS

export type MainCommandId = {
  [K in CommandId]: (typeof COMMANDS)[K] extends { main: true } ? K : never
}[CommandId]

export function isCommandId(id: unknown): id is CommandId {
  return typeof id === 'string' && Object.hasOwn(COMMANDS, id)
}

export function isMainCommand(id: unknown): id is MainCommandId {
  return isCommandId(id) && (COMMANDS[id] as CommandSpec).main === true
}

/** User overrides of command shortcuts; an empty string removes the shortcut. */
export type ShortcutOverrides = Partial<Record<CommandId, string>>

/** The shortcut a command has after applying the user's overrides. */
export function shortcutFor(id: CommandId, overrides: ShortcutOverrides): string | undefined {
  const override = overrides[id]
  if (override !== undefined) return override || undefined
  return (COMMANDS[id] as CommandSpec).accelerator
}

export const HEADING_COMMANDS = [
  'paragraph.heading1',
  'paragraph.heading2',
  'paragraph.heading3',
  'paragraph.heading4',
  'paragraph.heading5',
  'paragraph.heading6'
] as const satisfies readonly CommandId[]
