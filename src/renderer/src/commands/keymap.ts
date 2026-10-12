import { COMMANDS, type CommandId } from '../../../shared/commands'

// Maps Electron accelerator strings (from shared/commands.ts) to keyboard events. Keys are
// matched by physical key (`event.code`), so Ctrl+Shift+[ works even though Shift turns
// "[" into "{".

interface Shortcut {
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

export function parseAccelerator(accelerator: string): Shortcut {
  const parts = accelerator.split('+')
  const key = parts.pop()!
  const modifiers = new Set(parts.map((p) => p.toLowerCase()))
  let code: string
  if (/^[a-z]$/i.test(key)) code = `Key${key.toUpperCase()}`
  else if (/^[0-9]$/.test(key)) code = `Digit${key}`
  else if (/^F\d{1,2}$/i.test(key)) code = key.toUpperCase()
  else if (PUNCTUATION_CODES[key]) code = PUNCTUATION_CODES[key]
  else throw new Error(`Unsupported accelerator key: ${accelerator}`)
  return {
    ctrl: modifiers.has('cmdorctrl') || modifiers.has('ctrl') || modifiers.has('control'),
    shift: modifiers.has('shift'),
    alt: modifiers.has('alt'),
    code
  }
}

type KeyLike = Pick<KeyboardEvent, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey' | 'code'>

const BINDINGS: Array<[Shortcut, CommandId]> = Object.entries(COMMANDS).flatMap(([id, spec]) => {
  const accelerator = (spec as { accelerator?: string }).accelerator
  return accelerator ? [[parseAccelerator(accelerator), id as CommandId]] : []
})

export function commandForKey(event: KeyLike): CommandId | null {
  for (const [s, id] of BINDINGS) {
    if (
      event.code === s.code &&
      event.ctrlKey === s.ctrl &&
      event.shiftKey === s.shift &&
      event.altKey === s.alt &&
      !event.metaKey
    ) {
      return id
    }
  }
  return null
}
