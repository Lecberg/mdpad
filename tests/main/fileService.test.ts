import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  decodeText,
  encodeText,
  readTextFile,
  writeTextFile
} from '../../src/main/services/fileService'

const fixturesDir = join(__dirname, '../fixtures')

describe('decodeText', () => {
  it('detects LF files', () => {
    expect(decodeText('a\nb\n')).toEqual({ text: 'a\nb\n', eol: '\n', bom: false })
  })

  it('detects CRLF and converts to LF', () => {
    expect(decodeText('a\r\nb\r\n')).toEqual({ text: 'a\nb\n', eol: '\r\n', bom: false })
  })

  it('detects and strips a BOM', () => {
    expect(decodeText('﻿# Hi\n')).toEqual({ text: '# Hi\n', eol: '\n', bom: true })
  })

  it('uses the majority line ending for mixed files', () => {
    expect(decodeText('a\r\nb\r\nc\n').eol).toBe('\r\n')
    expect(decodeText('a\nb\nc\r\n').eol).toBe('\n')
  })

  it('handles empty files', () => {
    expect(decodeText('')).toEqual({ text: '', eol: '\n', bom: false })
  })

  it('decodes UTF-8 bytes', () => {
    expect(decodeText(Buffer.from('中文\n', 'utf8')).text).toBe('中文\n')
  })
})

describe('encodeText', () => {
  it('restores CRLF and BOM', () => {
    expect(encodeText('a\nb\n', { eol: '\r\n', bom: true })).toBe('﻿a\r\nb\r\n')
  })

  it.each(readdirSync(fixturesDir))('round-trips fixture bytes: %s', (name) => {
    const raw = readFileSync(join(fixturesDir, name))
    const { text, ...format } = decodeText(raw)
    expect(Buffer.from(encodeText(text, format), 'utf8').equals(raw)).toBe(true)
  })
})

describe('writeTextFile', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mdpad-test-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates a new file with the requested format', async () => {
    const path = join(dir, 'new.md')
    await writeTextFile(path, '# Hi\n', { eol: '\r\n', bom: true })
    expect(readFileSync(path, 'utf8')).toBe('﻿# Hi\r\n')
  })

  it('replaces an existing file and leaves no temp files behind', async () => {
    const path = join(dir, 'note.md')
    writeFileSync(path, 'old content that is longer than the new one\n')
    await writeTextFile(path, 'new\n', { eol: '\n', bom: false })
    expect(readFileSync(path, 'utf8')).toBe('new\n')
    expect(readdirSync(dir)).toEqual(['note.md'])
  })

  it('round-trips through readTextFile', async () => {
    const path = join(dir, 'note.md')
    writeFileSync(path, '﻿line 1\r\nline 2\r\n')
    const file = await readTextFile(path)
    await writeTextFile(path, file.text, file)
    expect(readFileSync(path, 'utf8')).toBe('﻿line 1\r\nline 2\r\n')
  })

  it('fails without touching the target when the directory does not exist', async () => {
    await expect(
      writeTextFile(join(dir, 'missing', 'note.md'), 'x', { eol: '\n', bom: false })
    ).rejects.toThrow()
  })
})
