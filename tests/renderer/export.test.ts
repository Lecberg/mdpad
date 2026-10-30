import { describe, expect, it } from 'vitest'
import { buildExportHtml, documentTitle } from '@renderer/export/buildHtml'

const SAMPLE = [
  '---',
  'title: hidden front matter',
  '---',
  '',
  '# Report',
  '',
  'Energy $E = mc^2$ and ==important== text.<script>alert(1)</script>',
  '',
  '$$',
  'a^2 + b^2 = c^2',
  '$$',
  '',
  '```js',
  'const x = 1',
  '```',
  '',
  '```mermaid',
  'graph LR; A-->B',
  '```',
  '',
  '- [x] done',
  ''
].join('\n')

describe('buildExportHtml', () => {
  it('produces a standalone page with math, highlights, code and diagrams', async () => {
    const html = await buildExportHtml(SAMPLE, {
      title: 'Report',
      renderDiagram: async (source) => `<svg data-source="${source.length}"></svg>`
    })
    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain('<title>Report</title>')
    expect(html).toContain('<mark>important</mark>')
    expect(html).toContain('class="katex"')
    expect(html).toContain('class="math-display"')
    expect(html).toContain('<span class="tok-keyword">const</span>')
    expect(html).toContain('<div class="diagram"><svg')
    expect(html).toContain('type="checkbox"')
    expect(html).not.toContain('hidden front matter')
    expect(html).not.toContain('<script>')
  })

  it('keeps diagram source as code when a diagram fails, and sets a base URL', async () => {
    const html = await buildExportHtml('```mermaid\nnot a diagram\n```\n', {
      title: 'x',
      baseHref: 'file:///C:/Notes/',
      renderDiagram: () => Promise.reject(new Error('bad'))
    })
    expect(html).toContain('<base href="file:///C:/Notes/">')
    expect(html).toContain('not a diagram')
  })

  it('writes the chosen text width and font size into the page', async () => {
    const html = await buildExportHtml('# Layout\n', {
      title: 'Layout',
      layout: { textWidth: 1000, fontSize: 20 }
    })
    expect(html).toContain(':root{--export-text-width:1000px;--export-font-size:20px}')
  })

  it('takes the title from the first heading', () => {
    expect(documentTitle('intro\n\n# The *Real* Title\n', 'file')).toBe('The Real Title')
    expect(documentTitle('no heading', 'file')).toBe('file')
  })
})
