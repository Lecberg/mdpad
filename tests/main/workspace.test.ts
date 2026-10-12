import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FolderSession } from '../../src/main/folderSession'
import {
  findInText,
  flattenFiles,
  invalidNameReason,
  isInsideFolder,
  scanFolder,
  searchFiles
} from '../../src/main/services/folderService'
import { RecentStore } from '../../src/main/services/recentService'
import { SettingsStore } from '../../src/main/services/settingsService'
import { DEFAULT_SETTINGS, sanitizeSettings } from '../../src/shared/settings'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mdpad-ws-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function makeTree(): void {
  mkdirSync(join(dir, 'notes', 'deep'), { recursive: true })
  mkdirSync(join(dir, '.git'))
  mkdirSync(join(dir, 'node_modules'))
  mkdirSync(join(dir, 'empty'))
  writeFileSync(join(dir, 'b.md'), 'beta\n')
  writeFileSync(join(dir, 'a10.md'), 'ten\n')
  writeFileSync(join(dir, 'a2.markdown'), 'two\n')
  writeFileSync(join(dir, 'image.png'), 'x')
  writeFileSync(join(dir, '.git', 'HEAD.md'), 'hidden')
  writeFileSync(join(dir, 'node_modules', 'pkg.md'), 'dep')
  writeFileSync(join(dir, 'notes', 'todo.md'), '- [ ] Cat food\n- [ ] cat litter\n')
  writeFileSync(join(dir, 'notes', 'deep', 'x.txt'), 'plain\n')
}

describe('scanFolder', () => {
  it('lists folders first, then Markdown files, in natural order', async () => {
    makeTree()
    const { children, truncated } = await scanFolder(dir)
    expect(truncated).toBe(false)
    expect(children.map((n) => n.name)).toEqual(['empty', 'notes', 'a2.markdown', 'a10.md', 'b.md'])
    const notes = children.find((n) => n.name === 'notes')!
    expect(notes.children!.map((n) => n.name)).toEqual(['deep', 'todo.md'])
    expect(notes.children![0].children!.map((n) => n.name)).toEqual(['x.txt'])
  })

  it('skips hidden folders, node_modules and non-Markdown files', async () => {
    makeTree()
    const files = flattenFiles((await scanFolder(dir)).children)
    expect(files.some((f) => /\.git|node_modules|image\.png/.test(f))).toBe(false)
    expect(files).toHaveLength(5)
  })

  it('stops at the entry limit and says so', async () => {
    makeTree()
    const snapshot = await scanFolder(dir, { maxEntries: 2, maxDepth: 16 })
    expect(snapshot.truncated).toBe(true)
  })
})

describe('search', () => {
  it('finds every occurrence with line, column and a highlighted preview', () => {
    const matches = findInText('one cat\nno\nCat and cat\n', 'cat', false)
    expect(matches.map((m) => [m.line, m.column, m.occurrence])).toEqual([
      [1, 4, 0],
      [3, 0, 1],
      [3, 8, 2]
    ])
    const m = matches[1]
    expect(m.preview.slice(m.previewStart, m.previewEnd)).toBe('Cat')
  })

  it('respects match case', () => {
    expect(findInText('Cat cat', 'Cat', true).map((m) => m.column)).toEqual([0])
  })

  it('shortens long lines around the match', () => {
    const line = `${'x'.repeat(300)}needle${'y'.repeat(300)}`
    const [m] = findInText(line, 'needle', false)
    expect(m.preview.length).toBeLessThan(200)
    expect(m.preview.startsWith('…')).toBe(true)
    expect(m.preview.slice(m.previewStart, m.previewEnd)).toBe('needle')
  })

  it('searches files, ignoring a BOM and capping the total', async () => {
    makeTree()
    writeFileSync(join(dir, 'bom.md'), '\uFEFFcat first\n')
    const files = [join(dir, 'notes', 'todo.md'), join(dir, 'bom.md'), join(dir, 'b.md')]
    const result = await searchFiles(files, 'cat', false)
    expect(result.total).toBe(3)
    expect(result.files.map((f) => f.path)).toEqual([files[0], files[1]])
    expect(result.files[1].matches[0].column).toBe(0)
    const capped = await searchFiles(files, 'cat', false, 2)
    expect(capped.total).toBe(2)
    expect(capped.truncated).toBe(true)
  })
})

describe('names and paths', () => {
  it('rejects names Windows cannot use', () => {
    for (const bad of [
      '',
      '  ',
      'a/b',
      'a\\b',
      'what?',
      'a:b',
      'trailing.',
      'trailing ',
      'CON',
      'nul.md',
      '..'
    ]) {
      expect(invalidNameReason(bad), bad).not.toBeNull()
    }
    for (const good of ['notes.md', 'Week 1.md', '日记.md', '.hidden', 'a.b.c']) {
      expect(invalidNameReason(good), good).toBeNull()
    }
  })

  it('checks containment case-insensitively and rejects escapes', () => {
    expect(isInsideFolder('C:\\Notes', 'c:\\notes\\a\\b.md')).toBe(true)
    expect(isInsideFolder('C:\\Notes', 'C:\\Notes')).toBe(true)
    expect(isInsideFolder('C:\\Notes', 'C:\\Notes\\..\\secret.md')).toBe(false)
    expect(isInsideFolder('C:\\Notes', 'C:\\Notes2\\a.md')).toBe(false)
    expect(isInsideFolder('C:\\Notes', 'D:\\Notes\\a.md')).toBe(false)
  })
})

describe('FolderSession', () => {
  it('rescans after files change on disk', async () => {
    writeFileSync(join(dir, 'first.md'), '')
    const updates: string[][] = []
    const session = new FolderSession(dir, (s) => updates.push(flattenFiles(s.children)), 50)
    expect(flattenFiles((await session.current()).children)).toHaveLength(1)
    writeFileSync(join(dir, 'second.md'), '')
    await expect.poll(() => updates.at(-1)?.length, { timeout: 3000 }).toBe(2)
    session.dispose()
  })
})

describe('settings', () => {
  it('fills in defaults and repairs bad values', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    const repaired = sanitizeSettings({
      theme: 'neon',
      fontSize: 400,
      lineWidth: 'wide',
      autosave: 'yes',
      fontFamily: 'Georgia; } body { display:none',
      shortcuts: {
        'format.bold': 'CmdOrCtrl+Shift+B',
        'format.italic': '',
        'format.code': 'Hyper+Q',
        'not.a.command': 'CmdOrCtrl+J'
      }
    })
    expect(repaired.theme).toBe('system')
    expect(repaired.fontSize).toBe(28)
    expect(repaired.lineWidth).toBe(DEFAULT_SETTINGS.lineWidth)
    expect(repaired.autosave).toBe(true)
    expect(repaired.fontFamily).not.toMatch(/[;{}]/)
    expect(repaired.shortcuts).toEqual({ 'format.bold': 'CmdOrCtrl+Shift+B', 'format.italic': '' })
  })

  it('persists updates and reloads them', async () => {
    const path = join(dir, 'settings.json')
    const store = new SettingsStore(path)
    await store.load()
    await store.update({ theme: 'dark', fontSize: 18 })
    expect(JSON.parse(readFileSync(path, 'utf8')).theme).toBe('dark')
    const reloaded = new SettingsStore(path)
    expect((await reloaded.load()).fontSize).toBe(18)
  })
})

describe('RecentStore', () => {
  it('keeps the newest first, without duplicates, and persists', async () => {
    const path = join(dir, 'recent.json')
    const store = new RecentStore(path)
    await store.load()
    let changes = 0
    store.onChange(() => changes++)
    await store.addFile('C:\\a.md')
    await store.addFile('C:\\b.md')
    await store.addFile('c:\\A.md')
    await store.addFolder('C:\\Notes')
    expect(store.current.files).toEqual(['c:\\A.md', 'C:\\b.md'])
    expect(changes).toBe(4)
    await store.remove('C:\\B.md')
    const reloaded = new RecentStore(path)
    await reloaded.load()
    expect(reloaded.current).toEqual({ files: ['c:\\A.md'], folders: ['C:\\Notes'] })
  })
})
