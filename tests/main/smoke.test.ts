import { describe, expect, it } from 'vitest'

// Placeholder until fileService tests land in M1; confirms the node test project runs.
describe('main test project', () => {
  it('runs in a Node environment', () => {
    expect(typeof process.versions.node).toBe('string')
    expect(typeof globalThis.document).toBe('undefined')
  })
})
