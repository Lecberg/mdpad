import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { filesFromArgv } from '../../src/main/argv'

describe('filesFromArgv', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mdpad-argv-'))
  writeFileSync(join(dir, 'note.md'), '# hi\n')
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('keeps existing files, resolved against cwd', () => {
    expect(filesFromArgv(['mdpad.exe', 'note.md'], dir)).toEqual([join(dir, 'note.md')])
  })

  it('skips the executable, flags, directories and missing files', () => {
    const argv = [join(dir, 'note.md'), '.', '--inspect=0', 'missing.md', dir]
    expect(filesFromArgv(argv, dir)).toEqual([])
  })
})
