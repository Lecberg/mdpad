import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { localPathFromUrl } from '../../src/main/localFileUrl'
import { saveImageNextTo, timestamp } from '../../src/main/services/imageService'
import { RecoveryStore } from '../../src/main/services/recoveryService'
import { watchFile } from '../../src/main/services/fileWatcher'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mdpad-svc-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
const when = new Date(2026, 9, 12, 15, 30, 45)

describe('saveImageNextTo', () => {
  it('stores the image in "<doc>.assets" and returns a relative src', async () => {
    const doc = join(dir, 'My Notes.md')
    const src = await saveImageNextTo(doc, 'image/png', PNG, when)
    expect(src).toBe('My Notes.assets/image-20261012-153045.png')
    expect(readFileSync(join(dir, src))).toEqual(Buffer.from(PNG))
  })

  it('never overwrites an existing image', async () => {
    const doc = join(dir, 'a.md')
    const first = await saveImageNextTo(doc, 'image/png', PNG, when)
    const second = await saveImageNextTo(doc, 'image/jpeg', PNG, when)
    const third = await saveImageNextTo(doc, 'image/png', PNG, when)
    expect([first, second, third]).toEqual([
      'a.assets/image-20261012-153045.png',
      'a.assets/image-20261012-153045.jpg',
      'a.assets/image-20261012-153045-1.png'
    ])
  })

  it('rejects non-image types', async () => {
    await expect(
      saveImageNextTo(join(dir, 'a.md'), 'application/x-msdownload', PNG)
    ).rejects.toThrow(/Unsupported/)
  })

  it('formats timestamps in local time', () => {
    expect(timestamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405')
  })
})

describe('RecoveryStore', () => {
  it('writes, lists and discards drafts', async () => {
    const store = new RecoveryStore(join(dir, 'recovery'))
    await store.write('w1', { path: null, text: 'draft one', format: { eol: '\n', bom: false } })
    await store.write('w2', {
      path: 'C:\\a.md',
      text: 'draft two',
      format: { eol: '\r\n', bom: true }
    })
    const listed = await store.list()
    expect(listed.map((d) => [d.id, d.draft.text, d.draft.path])).toEqual([
      ['w1', 'draft one', null],
      ['w2', 'draft two', 'C:\\a.md']
    ])
    await store.discard('w1')
    expect((await store.list()).map((d) => d.id)).toEqual(['w2'])
  })

  it('a discard issued after a write always wins', async () => {
    const store = new RecoveryStore(join(dir, 'recovery'))
    const format = { eol: '\n' as const, bom: false }
    void store.write('w', { path: null, text: 'a', format })
    void store.write('w', { path: null, text: 'b', format })
    await store.discard('w')
    expect(await store.list()).toEqual([])
  })

  it('skips corrupt drafts and a missing folder', async () => {
    const store = new RecoveryStore(join(dir, 'recovery'))
    expect(await store.list()).toEqual([])
    await store.write('ok', { path: null, text: 'fine', format: { eol: '\n', bom: false } })
    writeFileSync(join(dir, 'recovery', 'bad.json'), '{not json')
    expect((await store.list()).map((d) => d.id)).toEqual(['ok'])
    expect(readdirSync(join(dir, 'recovery')).some((n) => n.endsWith('.tmp'))).toBe(false)
  })
})

describe('localPathFromUrl', () => {
  it('maps app URLs back to Windows paths', () => {
    expect(localPathFromUrl('mdpad-file://local/C:/Users/me/My%20Notes.assets/a.png')).toBe(
      'C:/Users/me/My Notes.assets/a.png'
    )
  })

  it('rejects other schemes and garbage', () => {
    expect(localPathFromUrl('file:///C:/a.png')).toBeNull()
    expect(localPathFromUrl('not a url')).toBeNull()
  })
})

describe('watchFile', () => {
  it('reports changes to the file, not to its neighbours', async () => {
    const file = join(dir, 'watched.md')
    writeFileSync(file, 'one')
    let calls = 0
    const stop = watchFile(file, () => calls++, 50)
    await new Promise((r) => setTimeout(r, 100))
    writeFileSync(join(dir, 'other.md'), 'x')
    await new Promise((r) => setTimeout(r, 200))
    expect(calls).toBe(0)
    writeFileSync(file, 'two')
    await new Promise((r) => setTimeout(r, 300))
    expect(calls).toBe(1)
    stop()
  })
})
