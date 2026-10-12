import { describe, expect, it } from 'vitest'

// Placeholder until round-trip tests land in M1; confirms the DOM test project runs,
// since headless Milkdown needs a DOM.
describe('markdown test project', () => {
  it('runs with a DOM available', () => {
    const el = document.createElement('p')
    el.textContent = 'hello'
    document.body.append(el)
    expect(document.querySelector('p')?.textContent).toBe('hello')
  })
})
