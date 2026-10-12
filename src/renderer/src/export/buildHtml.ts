import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { classHighlighter, highlightCode } from '@lezer/highlight'
import katexCss from 'katex/dist/katex.min.css?inline'
import type { Code, Root } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype, { type Options as ToHastOptions } from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { renderTex } from '../editor/plugins/math'
import remarkHighlight from '../markdown/remarkHighlight'
import remarkMath from '../markdown/remarkMath'
import { MATH_LANGUAGES } from '../editor/previews'
import exportCss from './export.css?inline'

// Turns a document into a standalone HTML page for File › Export (HTML, and PDF, which is
// printed from this HTML). Raw HTML written in the Markdown is left out, as in the editor.

export interface ExportOptions {
  title: string
  /** Base URL for relative links and images (needed when the page is printed elsewhere). */
  baseHref?: string | null
  /** Render a Mermaid diagram to SVG; diagrams stay as code when not given. */
  renderDiagram?: (source: string) => Promise<string>
  /** Embed the math fonts as data URLs, so the file works offline and on its own. */
  embedFonts?: boolean
}

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Code as HTML with CodeMirror's highlighting classes (`tok-keyword`, …). */
async function highlighted(code: string, language: string): Promise<string> {
  const description = language
    ? LanguageDescription.matchLanguageName(languages, language, true)
    : null
  if (!description) return escapeHtml(code)
  try {
    const support = await description.load()
    const tree = support.language.parser.parse(code)
    let html = ''
    highlightCode(
      code,
      tree,
      classHighlighter,
      (text, classes) => {
        html += classes ? `<span class="${classes}">${escapeHtml(text)}</span>` : escapeHtml(text)
      },
      () => {
        html += '\n'
      }
    )
    return html
  } catch {
    return escapeHtml(code)
  }
}

/** Replace KaTeX's font file URLs with data URLs (only the woff2 ones browsers use). */
async function embedFontUrls(css: string): Promise<string> {
  const urls = [
    ...new Set([...css.matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)].map((m) => m[1]))
  ]
  const replacements = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(new URL(url, document.baseURI))
        const bytes = new Uint8Array(await response.arrayBuffer())
        let binary = ''
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        }
        return [url, `data:font/woff2;base64,${btoa(binary)}`] as const
      } catch {
        return [url, url] as const
      }
    })
  )
  let result = css
  for (const [url, data] of replacements) result = result.split(url).join(data)
  return result
}

const raw = (value: string): never => ({ type: 'raw', value }) as never

export async function buildExportHtml(markdown: string, options: ExportOptions): Promise<string> {
  const parser = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMath)
    .use(remarkHighlight)
  const tree = parser.runSync(parser.parse(markdown), markdown) as Root

  // Code blocks are rendered up front, since highlighting and diagrams are asynchronous.
  let hasMath = false
  const codeHtml = new Map<Code, string>()
  const jobs: Array<Promise<void>> = []
  visit(tree, (node) => {
    if (node.type === 'math' || node.type === 'inlineMath') hasMath = true
    if (node.type !== 'code') return
    const language = (node.lang ?? '').toLowerCase()
    if (MATH_LANGUAGES.has(language)) {
      hasMath = true
      codeHtml.set(node, `<div class="math-display">${renderTex(node.value, true)}</div>`)
    } else if (language === 'mermaid' && options.renderDiagram) {
      jobs.push(
        options.renderDiagram(node.value).then(
          (svg) => void codeHtml.set(node, `<div class="diagram">${svg}</div>`),
          () => undefined // invalid diagram: export its source as code
        )
      )
    }
    jobs.push(
      highlighted(node.value, language).then((html) => {
        if (codeHtml.has(node)) return
        const cls = language ? ` class="language-${escapeHtml(language)}"` : ''
        codeHtml.set(node, `<pre><code${cls}>${html}</code></pre>`)
      })
    )
  })
  await Promise.all(jobs)

  const handlers: ToHastOptions['handlers'] = {
    yaml: () => undefined,
    code: (_state, node: Code) => raw(codeHtml.get(node) ?? ''),
    math: (_state, node: { value: string }) =>
      raw(`<div class="math-display">${renderTex(node.value, true)}</div>`),
    inlineMath: (_state, node: { value: string }) => raw(renderTex(node.value, false)),
    highlight: (state, node) => ({
      type: 'element',
      tagName: 'mark',
      properties: {},
      children: state.all(node)
    })
  }
  const toHtml = unified().use(remarkRehype, { handlers }).use(rehypeStringify, {
    allowDangerousHtml: true // only the HTML rendered above; Markdown's own HTML is dropped
  })
  const body = toHtml.stringify(await toHtml.run(tree))

  const styles = [exportCss]
  if (hasMath) styles.push(options.embedFonts ? await embedFontUrls(katexCss) : katexCss)
  const base = options.baseHref ? `<base href="${escapeHtml(options.baseHref)}">` : ''
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(options.title)}</title>`,
    base,
    `<style>${styles.join('\n')}</style>`,
    '</head>',
    '<body>',
    `<article class="markdown-body">${body}</article>`,
    '</body>',
    '</html>',
    ''
  ].join('\n')
}

/** The document's title: its first top-level heading, else the file name. */
export function documentTitle(markdown: string, fallback: string): string {
  const heading = /^#\s+(.+?)\s*#*\s*$/m.exec(markdown)
  return heading ? heading[1].replace(/[*_`[\]]/g, '') : fallback
}
