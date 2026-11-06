import { describe, expect, it } from 'vitest'
import { pruneWritablePaths } from '../../src/main/services/writablePaths'

describe('pruneWritablePaths', () => {
  it('keeps only the current document path', () => {
    const paths = new Set(['c:\\a.md', 'c:\\b.md'])
    pruneWritablePaths(paths, 'c:\\b.md')
    expect([...paths]).toEqual(['c:\\b.md'])
  })

  it('clears everything when the document has no path', () => {
    const paths = new Set(['c:\\a.md'])
    pruneWritablePaths(paths, null)
    expect(paths.size).toBe(0)
  })

  it('leaves a set that already contains only the current key alone', () => {
    const paths = new Set(['c:\\a.md'])
    pruneWritablePaths(paths, 'c:\\a.md')
    expect([...paths]).toEqual(['c:\\a.md'])
  })
})
