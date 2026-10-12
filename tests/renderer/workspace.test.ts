import { describe, expect, it } from 'vitest'
import { commandForKey, setShortcutOverrides } from '@renderer/commands/keymap'
import { fuzzyMatch, rankFuzzy } from '@renderer/lib/fuzzy'
import {
  ancestorsWithin,
  baseName,
  dirName,
  extensionOf,
  isInside,
  isMarkdownName,
  relativeTo,
  samePath
} from '@renderer/lib/paths'
import {
  acceleratorFromEvent,
  displayAccelerator,
  sameShortcut
} from '../../src/shared/accelerators'
import { shortcutFor } from '../../src/shared/commands'

type Mods = { ctrl?: boolean; shift?: boolean; alt?: boolean }
const key = (code: string, mods: Mods = {}): Parameters<typeof commandForKey>[0] => ({
  code,
  ctrlKey: mods.ctrl ?? false,
  shiftKey: mods.shift ?? false,
  altKey: mods.alt ?? false,
  metaKey: false
})

describe('fuzzy matching', () => {
  it('requires the characters in order', () => {
    expect(fuzzyMatch('wkn', 'notes/week-notes.md')).not.toBeNull()
    expect(fuzzyMatch('xyz', 'notes/week-notes.md')).toBeNull()
  })

  it('prefers file-name prefixes and word starts', () => {
    const files = [
      'projects/todo-archive.md',
      'daily/2026-10-12.md',
      'todo.md',
      'misc/the-old-door.md'
    ]
    const ranked = rankFuzzy(files, 'todo', (f) => f).map((r) => r.item)
    expect(ranked[0]).toBe('todo.md')
    expect(ranked).toContain('projects/todo-archive.md')
    expect(ranked.indexOf('projects/todo-archive.md')).toBeLessThan(
      ranked.indexOf('misc/the-old-door.md')
    )
  })

  it('reports matched positions for highlighting', () => {
    expect(fuzzyMatch('wn', 'week-notes')!.indices).toEqual([0, 5])
  })

  it('keeps input order for an empty query', () => {
    expect(rankFuzzy(['b', 'a'], '', (x) => x).map((r) => r.item)).toEqual(['b', 'a'])
  })
})

describe('renderer path helpers', () => {
  it('compares and splits Windows paths', () => {
    expect(samePath('C:\\Notes\\A.md', 'c:/notes/a.md')).toBe(true)
    expect(samePath(null, 'a')).toBe(false)
    expect(baseName('C:\\Notes\\a.md')).toBe('a.md')
    expect(dirName('C:\\Notes\\a.md')).toBe('C:\\Notes')
    expect(isInside('C:\\Notes', 'C:\\Notes\\sub\\a.md')).toBe(true)
    expect(isInside('C:\\Notes', 'C:\\Notes2\\a.md')).toBe(false)
    expect(relativeTo('C:\\Notes', 'C:\\Notes\\sub\\a.md')).toBe('sub/a.md')
    expect(ancestorsWithin('C:\\Notes', 'C:\\Notes\\a\\b\\c.md')).toEqual([
      'C:\\Notes\\a',
      'C:\\Notes\\a\\b'
    ])
  })

  it('recognises Markdown names and extensions', () => {
    expect(isMarkdownName('a.MD')).toBe(true)
    expect(isMarkdownName('a.png')).toBe(false)
    expect(extensionOf('v1.2 notes.md')).toBe('.md')
    expect(extensionOf('README')).toBe('')
  })
})

describe('recording shortcuts', () => {
  it('turns key presses into accelerators', () => {
    expect(acceleratorFromEvent(key('KeyB', { ctrl: true, shift: true }))).toBe('CmdOrCtrl+Shift+B')
    expect(acceleratorFromEvent(key('Digit5', { alt: true, shift: true }))).toBe('Alt+Shift+5')
    expect(acceleratorFromEvent(key('BracketLeft', { ctrl: true }))).toBe('CmdOrCtrl+[')
    expect(acceleratorFromEvent(key('F9'))).toBe('F9')
  })

  it('rejects keys that would stop typing or are modifiers alone', () => {
    expect(acceleratorFromEvent(key('KeyF'))).toBeNull()
    expect(acceleratorFromEvent(key('KeyB', { shift: true }))).toBeNull()
    expect(acceleratorFromEvent(key('ShiftLeft', { shift: true }))).toBeNull()
    expect(acceleratorFromEvent(key('Enter', { ctrl: true }))).toBeNull()
  })

  it('compares and displays accelerators', () => {
    expect(sameShortcut('CmdOrCtrl+Shift+B', 'Ctrl+Shift+B')).toBe(true)
    expect(sameShortcut('CmdOrCtrl+B', 'CmdOrCtrl+Shift+B')).toBe(false)
    expect(displayAccelerator('CmdOrCtrl+Shift+K')).toBe('Ctrl+Shift+K')
  })
})

describe('shortcut overrides', () => {
  it('apply to the keymap and can remove a shortcut', () => {
    expect(shortcutFor('format.bold', { 'format.bold': 'CmdOrCtrl+Shift+B' })).toBe(
      'CmdOrCtrl+Shift+B'
    )
    expect(shortcutFor('format.bold', { 'format.bold': '' })).toBeUndefined()

    setShortcutOverrides({ 'format.bold': 'CmdOrCtrl+Shift+B', 'format.italic': '' })
    try {
      expect(commandForKey(key('KeyB', { ctrl: true, shift: true }))).toBe('format.bold')
      expect(commandForKey(key('KeyB', { ctrl: true }))).toBeNull()
      expect(commandForKey(key('KeyI', { ctrl: true }))).toBeNull()
      expect(commandForKey(key('KeyP', { ctrl: true }))).toBe('file.quickOpen')
    } finally {
      setShortcutOverrides({})
    }
    expect(commandForKey(key('KeyB', { ctrl: true }))).toBe('format.bold')
  })
})
