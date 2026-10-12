import { isValidAccelerator } from './accelerators'
import { isCommandId, type ShortcutOverrides } from './commands'

// User preferences, stored by the main process in userData/settings.json and shared with
// every window. Anything read from disk goes through sanitizeSettings, so a hand-edited or
// outdated file can never put the app in an invalid state.

export type ThemeSetting = 'system' | 'light' | 'dark'

export interface Settings {
  theme: ThemeSetting
  /** CSS font-family list for document text; empty means the built-in default. */
  fontFamily: string
  /** Document text size in px. */
  fontSize: number
  /** Maximum width of the text column in px. */
  lineWidth: number
  /** Save files that already have a name shortly after typing stops. */
  autosave: boolean
  /** Dim everything except the block being edited (F8). */
  focusMode: boolean
  /** Keep the line being edited in the middle of the window (F9). */
  typewriterMode: boolean
  shortcuts: ShortcutOverrides
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontFamily: '',
  fontSize: 16,
  lineWidth: 740,
  autosave: true,
  focusMode: false,
  typewriterMode: false,
  shortcuts: {}
}

export const FONT_SIZE_RANGE = { min: 12, max: 28 } as const
export const LINE_WIDTH_RANGE = { min: 480, max: 1600 } as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function clampInt(value: unknown, range: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(range.max, Math.max(range.min, Math.round(value)))
}

function sanitizeShortcuts(value: unknown): ShortcutOverrides {
  const result: ShortcutOverrides = {}
  if (!isRecord(value)) return result
  for (const [id, accelerator] of Object.entries(value)) {
    if (!isCommandId(id) || typeof accelerator !== 'string') continue
    if (accelerator === '' || isValidAccelerator(accelerator)) result[id] = accelerator
  }
  return result
}

/** A complete, valid Settings object from anything (missing or bad fields get defaults). */
export function sanitizeSettings(raw: unknown): Settings {
  const value = isRecord(raw) ? raw : {}
  const d = DEFAULT_SETTINGS
  return {
    theme: value.theme === 'light' || value.theme === 'dark' ? value.theme : 'system',
    fontFamily:
      typeof value.fontFamily === 'string'
        ? value.fontFamily
            .replace(/[;{}<>]/g, '')
            .trim()
            .slice(0, 200)
        : d.fontFamily,
    fontSize: clampInt(value.fontSize, FONT_SIZE_RANGE, d.fontSize),
    lineWidth: clampInt(value.lineWidth, LINE_WIDTH_RANGE, d.lineWidth),
    autosave: typeof value.autosave === 'boolean' ? value.autosave : d.autosave,
    focusMode: value.focusMode === true,
    typewriterMode: value.typewriterMode === true,
    shortcuts: sanitizeShortcuts(value.shortcuts)
  }
}
