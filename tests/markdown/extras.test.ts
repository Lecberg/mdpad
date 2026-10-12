import { describe, expect, it } from 'vitest'
import { editorViewCtx } from '@milkdown/kit/core'
import type { Node } from '@milkdown/kit/prose/model'
import { openSession } from './helpers'

// M5 syntax: inline/display math and ==highlight==.

function nodeNames(doc: Node): string[] {
  const names: string[] = []
  doc.descendants((node) => {
    names.push(
      node.isText ? `text(${node.marks.map((m) => m.type.name).join(',')})` : node.type.name
    )
  })
  return names
}

async function parse(markdown: string): Promise<{ names: string[]; saved: string; doc: Node }> {
  const session = await openSession(markdown)
  const doc = session.editor.action((ctx) => ctx.get(editorViewCtx).state.doc)
  const result = { names: nodeNames(doc), saved: session.baseline, doc }
  await session.destroy()
  return result
}

describe('math', () => {
  it('parses inline and display math and writes them back', async () => {
    const md = 'Area $\\pi r^2$ here.\n\n$$\nE = mc^2\n$$\n'
    const { names, saved, doc } = await parse(md)
    expect(names).toContain('math_inline')
    expect(saved).toBe(md)
    let block: Node | null = null
    doc.descendants((n) => {
      if (n.type.name === 'code_block') block = n
    })
    expect(block!.attrs).toMatchObject({ language: 'math', math: true })
    expect(block!.textContent).toBe('E = mc^2')
  })

  it('leaves money amounts as text, without adding escapes', async () => {
    const md = 'It costs $5 and $10. Also $ x $ and $3$4.\n'
    const { names, saved } = await parse(md)
    expect(names).not.toContain('math_inline')
    expect(saved).toBe(md)
  })

  it('keeps a ```math fence a fence', async () => {
    const md = '```math\nx^2\n```\n'
    const { saved, doc } = await parse(md)
    expect(saved).toBe(md)
    expect(doc.firstChild!.attrs).toMatchObject({ language: 'math', math: false })
  })
})

describe('highlight', () => {
  it('parses ==text== including nested formatting', async () => {
    const md = 'A ==plain== and ==with *emphasis* inside== end.\n'
    const { names, saved } = await parse(md)
    expect(names.filter((n) => n.includes('highlight'))).toEqual([
      'text(highlight)',
      'text(highlight)',
      'text(emphasis,highlight)',
      'text(highlight)'
    ])
    expect(saved).toBe(md)
  })

  it('ignores runs of = and spaced delimiters', async () => {
    const md = 'a === b, x == y, and == spaced ==.\n'
    const { names, saved } = await parse(md)
    expect(names.some((n) => n.includes('highlight'))).toBe(false)
    expect(saved).toBe(md)
  })
})
