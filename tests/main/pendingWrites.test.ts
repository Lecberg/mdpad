import { describe, expect, it } from 'vitest'
import { PendingWrites } from '../../src/main/services/pendingWrites'

describe('PendingWrites', () => {
  it('matches only the text of a recent write to the same path', () => {
    const writes = new PendingWrites()
    writes.note('c:\\a.md', 'one')
    expect(writes.matches('c:\\a.md', 'one')).toBe(true)
    expect(writes.matches('c:\\a.md', 'two')).toBe(false)
    expect(writes.matches('c:\\b.md', 'one')).toBe(false)
  })

  it('keeps back-to-back writes matchable', () => {
    const writes = new PendingWrites()
    writes.note('c:\\a.md', 'one')
    writes.note('c:\\a.md', 'two')
    expect(writes.matches('c:\\a.md', 'one')).toBe(true)
    expect(writes.matches('c:\\a.md', 'two')).toBe(true)
  })

  it('expires entries after the TTL', () => {
    const writes = new PendingWrites(1000)
    writes.note('c:\\a.md', 'one', 0)
    expect(writes.matches('c:\\a.md', 'one', 1000)).toBe(true)
    expect(writes.matches('c:\\a.md', 'one', 1001)).toBe(false)
  })

  it('forgets one matching entry at a time', () => {
    const writes = new PendingWrites()
    writes.note('c:\\a.md', 'one')
    writes.note('c:\\a.md', 'one')
    writes.forget('c:\\a.md', 'one')
    expect(writes.matches('c:\\a.md', 'one')).toBe(true)
    writes.forget('c:\\a.md', 'one')
    expect(writes.matches('c:\\a.md', 'one')).toBe(false)
  })

  it('drops the oldest entries beyond the cap', () => {
    const writes = new PendingWrites(5000, 2)
    writes.note('c:\\a.md', 'one', 0)
    writes.note('c:\\a.md', 'two', 1)
    writes.note('c:\\a.md', 'three', 2)
    expect(writes.matches('c:\\a.md', 'one', 3)).toBe(false)
    expect(writes.matches('c:\\a.md', 'two', 3)).toBe(true)
    expect(writes.matches('c:\\a.md', 'three', 3)).toBe(true)
  })

  it('clears a path', () => {
    const writes = new PendingWrites()
    writes.note('c:\\a.md', 'one')
    writes.clearPath('c:\\a.md')
    expect(writes.matches('c:\\a.md', 'one')).toBe(false)
  })
})
