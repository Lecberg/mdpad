import type MermaidApi from 'mermaid'
import { renderTex } from './plugins/math'

// Rendered previews for code blocks: display math (KaTeX) and Mermaid diagrams. The code
// block component shows them below the source; CSS hides the source unless the block has
// focus (see components.css), so a formula or diagram reads like part of the document.

type Apply = (value: null | string | HTMLElement) => void

export const MATH_LANGUAGES = new Set(['math', 'latex', 'tex', 'katex'])

let mermaidModule: Promise<typeof MermaidApi> | null = null
let queue: Promise<unknown> = Promise.resolve()
let counter = 0

/** Diagrams currently shown, so they can be redrawn when the theme changes. */
const shown = new Map<Apply, string>()
const MAX_TRACKED = 200

const isDark = (): boolean => document.documentElement.dataset.theme === 'dark'

function errorPreview(message: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'md-preview-error'
  el.textContent = message
  return el
}

/** Render a Mermaid diagram to SVG markup (rejects with Mermaid's error message). */
export function mermaidSvg(source: string, dark: boolean): Promise<string> {
  mermaidModule ??= import('mermaid').then((m) => m.default)
  // Mermaid keeps global configuration, so render one diagram at a time.
  const result = queue.then(async () => {
    const mermaid = await mermaidModule!
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: dark ? 'dark' : 'default',
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-ui')
    })
    await mermaid.parse(source)
    return (await mermaid.render(`mdpad-mermaid-${++counter}`, source)).svg
  })
  queue = result.catch(() => undefined)
  return result
}

function drawMermaid(source: string, apply: Apply): void {
  mermaidSvg(source, isDark()).then(apply, (error) =>
    apply(errorPreview(`Diagram error: ${(error as Error)?.message ?? error}`))
  )
}

export function renderMermaid(source: string, apply: Apply): void {
  shown.delete(apply)
  shown.set(apply, source)
  if (shown.size > MAX_TRACKED) shown.delete(shown.keys().next().value!)
  drawMermaid(source, apply)
}

/** Redraw diagrams in the current theme's colors. */
export function redrawDiagrams(): void {
  for (const [apply, source] of shown) drawMermaid(source, apply)
}

/** The code block component's renderPreview hook. */
export function renderPreview(
  language: string,
  content: string,
  apply: Apply
): string | null | void {
  const lang = language.toLowerCase()
  if (!content.trim()) return null
  if (MATH_LANGUAGES.has(lang)) return renderTex(content, true)
  if (lang === 'mermaid') return renderMermaid(content, apply)
  return null
}

// Diagrams are drawn in the theme's colors; redraw them when it changes.
let darkTheme = isDark()
new MutationObserver(() => {
  if (isDark() === darkTheme) return
  darkTheme = isDark()
  redrawDiagrams()
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme']
})
