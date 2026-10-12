import { describe, expect, it } from 'vitest'
import { commandForKey, parseAccelerator } from '@renderer/commands/keymap'
import { COMMANDS } from '../../src/shared/commands'

type Mods = { ctrl?: boolean; shift?: boolean; alt?: boolean }
type KeyLike = Parameters<typeof commandForKey>[0]

const key = (code: string, mods: Mods = {}): KeyLike => ({
  code,
  ctrlKey: mods.ctrl ?? false,
  shiftKey: mods.shift ?? false,
  altKey: mods.alt ?? false,
  metaKey: false
})

describe('parseAccelerator', () => {
  it('parses letters, digits and punctuation by physical key', () => {
    expect(parseAccelerator('CmdOrCtrl+B')).toEqual({
      ctrl: true,
      shift: false,
      alt: false,
      code: 'KeyB'
    })
    expect(parseAccelerator('CmdOrCtrl+Shift+[').code).toBe('BracketLeft')
    expect(parseAccelerator('CmdOrCtrl+Shift+`').code).toBe('Backquote')
    expect(parseAccelerator('CmdOrCtrl+1').code).toBe('Digit1')
    expect(parseAccelerator('F8').code).toBe('F8')
  })

  it('accepts every accelerator in the command table', () => {
    for (const spec of Object.values(COMMANDS)) {
      const accelerator = (spec as { accelerator?: string }).accelerator
      if (accelerator) expect(() => parseAccelerator(accelerator)).not.toThrow()
    }
  })
})

describe('commandForKey', () => {
  it('maps shortcuts to commands', () => {
    expect(commandForKey(key('KeyB', { ctrl: true }))).toBe('format.bold')
    expect(commandForKey(key('Digit2', { ctrl: true }))).toBe('paragraph.heading2')
    expect(commandForKey(key('Digit0', { ctrl: true }))).toBe('paragraph.paragraph')
    expect(commandForKey(key('BracketRight', { ctrl: true, shift: true }))).toBe(
      'paragraph.bulletList'
    )
    expect(commandForKey(key('Digit1', { ctrl: true, shift: true }))).toBe('view.outline')
    expect(commandForKey(key('Slash', { ctrl: true }))).toBe('view.sourceMode')
    expect(commandForKey(key('KeyS', { ctrl: true }))).toBe('file.save')
  })

  it('requires the exact modifiers', () => {
    expect(commandForKey(key('KeyB'))).toBeNull()
    expect(commandForKey(key('KeyB', { ctrl: true, shift: true }))).toBeNull()
    expect(commandForKey(key('KeyB', { ctrl: true, alt: true }))).toBeNull()
  })

  it('has no two commands on the same shortcut', () => {
    const seen = new Map<string, string>()
    for (const [id, spec] of Object.entries(COMMANDS)) {
      const accelerator = (spec as { accelerator?: string }).accelerator
      if (!accelerator) continue
      const signature = JSON.stringify(parseAccelerator(accelerator))
      expect(seen.get(signature), `${id} clashes with ${seen.get(signature)}`).toBeUndefined()
      seen.set(signature, id)
    }
  })
})
