// Commands the native menu forwards to the renderer. Commands the main process
// handles itself (New, Open, Close, Exit) are not listed here.
export const COMMAND_IDS = ['file.save', 'file.saveAs', 'edit.undo', 'edit.redo'] as const

export type CommandId = (typeof COMMAND_IDS)[number]
