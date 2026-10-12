import { afterEach, describe, expect, it } from 'vitest'
import { normalizeWith } from '@renderer/editor/markdownCore'
import { openSession, type Session } from '../markdown/helpers'

let session: Session | null = null
afterEach(async () => {
  await session?.destroy()
  session = null
})

async function normalize(markdown: string): Promise<string> {
  session ??= await openSession('')
  return normalizeWith(session.editor, markdown)
}

describe('autolink serialization', () => {
  it.each([
    'https://example.com',
    'https://example.com/path/to_page?q=1&lang=en#top',
    'http://localhost:3000/api'
  ])('writes %s as a bare URL', async (url) => {
    expect(await normalize(`See ${url} now\n`)).toBe(`See ${url} now\n`)
  })

  it('keeps <…> for URLs that a bare form might not round-trip', async () => {
    expect(await normalize('<https://example.com/a_>\n')).toBe('<https://example.com/a_>\n')
  })

  it('keeps ordinary links unchanged', async () => {
    expect(await normalize('[docs](https://example.com)\n')).toBe('[docs](https://example.com)\n')
  })

  it.each(['See https://example.com.', 'Go to https://example.com/a_b_c, then', '(https://x.dev)'])(
    'is stable across repeated saves: %s',
    async (text) => {
      const once = await normalize(text + '\n')
      expect(await normalize(once)).toBe(once)
    }
  )
})
