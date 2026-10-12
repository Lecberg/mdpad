// Commands handled by the renderer. The native menu shows these labels and shortcuts and
// forwards clicks; the renderer's own keymap (renderer/src/commands/keymap.ts) handles the
// keyboard shortcuts, so they work identically from the menu, the keyboard, and in tests.
// Accelerators use Electron's syntax.

interface CommandSpec {
  label: string
  accelerator?: string
}

export const COMMANDS = {
  'file.save': { label: 'Save', accelerator: 'CmdOrCtrl+S' },
  'file.saveAs': { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S' },

  'edit.undo': { label: 'Undo', accelerator: 'CmdOrCtrl+Z' },
  'edit.redo': { label: 'Redo', accelerator: 'CmdOrCtrl+Y' },

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
  'paragraph.horizontalRule': { label: 'Horizontal Line' },

  'format.bold': { label: 'Bold', accelerator: 'CmdOrCtrl+B' },
  'format.italic': { label: 'Italic', accelerator: 'CmdOrCtrl+I' },
  'format.code': { label: 'Inline Code', accelerator: 'CmdOrCtrl+Shift+`' },
  'format.link': { label: 'Link', accelerator: 'CmdOrCtrl+K' },

  'view.sourceMode': { label: 'Source Code Mode', accelerator: 'CmdOrCtrl+/' },
  'view.outline': { label: 'Outline', accelerator: 'CmdOrCtrl+Shift+1' }
} as const satisfies Record<string, CommandSpec>

export type CommandId = keyof typeof COMMANDS

export const HEADING_COMMANDS = [
  'paragraph.heading1',
  'paragraph.heading2',
  'paragraph.heading3',
  'paragraph.heading4',
  'paragraph.heading5',
  'paragraph.heading6'
] as const satisfies readonly CommandId[]
