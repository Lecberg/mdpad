import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { pathsFromArgv } from '../../src/main/argv'

describe('pathsFromArgv', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mdpad-argv-'))
  writeFileSync(join(dir, 'note.md'), '# hi\n')
  mkdirSync(join(dir, 'notes'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('keeps existing files and folders, resolved against cwd', () => {
    expect(pathsFromArgv(['mdpad.exe', 'note.md', 'notes'], dir)).toEqual({
      files: [join(dir, 'note.md')],
      folders: [join(dir, 'notes')]
    })
  })

  it('skips the executable, flags, missing paths and the app folder', () => {
    const argv = [join(dir, 'note.md'), '.', '--inspect=0', 'missing.md']
    expect(pathsFromArgv(argv, dir, dir)).toEqual({ files: [], folders: [] })
  })
})
