import { describe, expect, it } from 'vitest'
import { encodeText } from '../../src/main/services/fileService'
import { normalizeWith } from '@renderer/editor/markdownCore'
import {
  changedLines,
  findBlock,
  fixtureNames,
  insertText,
  openSession,
  readFixture
} from './helpers'

// The core M1 guarantee, checked against every file in tests/fixtures:
// opening and saving a file never changes anything except what the user edited.

describe.each(fixtureNames())('fixture %s', (name) => {
  const { raw, text, eol, bom } = readFixture(name)

  it('saves unedited files byte-for-byte', async () => {
    const session = await openSession(text)
    const saved = session.saveText()
    expect(Buffer.from(encodeText(saved, { eol, bom }), 'utf8').equals(raw)).toBe(true)
    await session.destroy()
  })

  it('serialization is stable (snapshot) and idempotent', async () => {
    const session = await openSession(text)
    await expect(session.baseline).toMatchFileSnapshot(`./__snapshots__/${name}`)
    expect(normalizeWith(session.editor, session.baseline)).toBe(session.baseline)
    await session.destroy()
  })

  it('editing one paragraph changes only that line', async () => {
    const session = await openSession(text)
    const pos = findBlock(
      session.editor,
      (n) => n.type.name === 'paragraph' && n.textContent !== ''
    )
    insertText(session.editor, pos, 'EDITED ')

    const saved = session.saveText()
    const changes = changedLines(text, saved)
    expect(changes).toHaveLength(1)
    const [before, after] = changes[0]
    expect(after.replace('EDITED ', '')).toBe(before)

    // Line endings, BOM and the final newline survive the edit too.
    const bytes = encodeText(saved, { eol, bom })
    expect(bytes.startsWith('﻿')).toBe(bom)
    if (eol === '\r\n') expect(bytes.replace(/\r\n/g, '')).not.toContain('\n')
    expect(saved.endsWith('\n')).toBe(text.endsWith('\n'))
    await session.destroy()
  })
})
