// Shortcuts are stored as Electron accelerator strings ("CmdOrCtrl+Shift+K"), which the
// native menu displays. The renderer matches them against keyboard events by physical key
// (`event.code`), so Ctrl+Shift+[ works even though Shift turns "[" into "{".

export interface Shortcut {
  ctrl: boolean
  shift: boolean
  alt: boolean
  code: string
}

const PUNCTUATION_CODES: Record<string, string> = {
  '`': 'Backquote',
  '/': 'Slash',
  '\\': 'Backslash',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '-': 'Minus',
  '=': 'Equal',
  ',': 'Comma',
  '.': 'Period',
  ';': 'Semicolon',
  "'": 'Quote'
}

const PUNCTUATION_KEYS = Object.fromEntries(
  Object.entries(PUNCTUATION_CODES).map(([key, code]) => [code, key])
)

export function parseAccelerator(accelerator: string): Shortcut {
  const parts = accelerator.split('+')
  const key = parts.pop()!
  const modifiers = new Set(parts.map((p) => p.toLowerCase()))
  let code: string
  if (/^[a-z]$/i.test(key)) code = `Key${key.toUpperCase()}`
  else if (/^[0-9]$/.test(key)) code = `Digit${key}`
  else if (/^F([1-9]|1[0-2])$/i.test(key)) code = key.toUpperCase()
  else if (PUNCTUATION_CODES[key]) code = PUNCTUATION_CODES[key]
  else throw new Error(`Unsupported accelerator key: ${accelerator}`)
  for (const modifier of modifiers) {
    if (!['cmdorctrl', 'ctrl', 'control', 'shift', 'alt'].includes(modifier)) {
      throw new Error(`Unsupported accelerator modifier: ${accelerator}`)
    }
  }
  return {
    ctrl: modifiers.has('cmdorctrl') || modifiers.has('ctrl') || modifiers.has('control'),
    shift: modifiers.has('shift'),
    alt: modifiers.has('alt'),
    code
  }
}

export function isValidAccelerator(accelerator: string): boolean {
  try {
    parseAccelerator(accelerator)
    return true
  } catch {
    return false
  }
}

export type KeyLike = Pick<KeyboardEvent, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey' | 'code'>

export function matchesShortcut(event: KeyLike, s: Shortcut): boolean {
  return (
    event.code === s.code &&
    event.ctrlKey === s.ctrl &&
    event.shiftKey === s.shift &&
    event.altKey === s.alt &&
    !event.metaKey
  )
}

/**
 * The accelerator for a key press when recording a new shortcut, or null if the press can't
 * be a shortcut: a lone modifier, an unsupported key, or a plain key without Ctrl/Alt
 * (which would stop that key from typing). Function keys may be used on their own.
 */
export function acceleratorFromEvent(event: KeyLike): string | null {
  const { code } = event
  const functionKey = /^F([1-9]|1[0-2])$/.test(code)
  let key: string | undefined
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3)
  else if (/^Digit[0-9]$/.test(code)) key = code.slice(5)
  else if (functionKey) key = code
  else key = PUNCTUATION_KEYS[code]
  if (!key || event.metaKey) return null
  if (!event.ctrlKey && !event.altKey && !functionKey) return null
  const parts: string[] = []
  if (event.ctrlKey) parts.push('CmdOrCtrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  parts.push(key)
  return parts.join('+')
}

/** Two accelerators that trigger on the same key press. */
export function sameShortcut(a: string, b: string): boolean {
  try {
    const x = parseAccelerator(a)
    const y = parseAccelerator(b)
    return x.code === y.code && x.ctrl === y.ctrl && x.shift === y.shift && x.alt === y.alt
  } catch {
    return false
  }
}

/** How a shortcut is shown in the UI on Windows: "Ctrl+Shift+K". */
export function displayAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => (/^(cmdorctrl|control)$/i.test(part) ? 'Ctrl' : part))
    .join('+')
}
