// A synthetic ~1 MB note with the usual mix of content, for the performance checks.

const PARAGRAPH =
  'This paragraph has **bold text**, *emphasis*, `inline code`, a [link](https://example.com) ' +
  'and enough ordinary words to wrap over a couple of lines in the editor, like a real note.'

export function largeDocument(targetBytes = 1_000_000): string {
  const parts: string[] = []
  let size = 0
  for (let section = 1; size < targetBytes; section++) {
    const block = [
      `## Section ${section}`,
      PARAGRAPH,
      `- item one of ${section}\n- item two with $x_${section}^2$\n- [ ] a task`,
      '```js\nfunction f(n) {\n  return n * 2\n}\n```',
      '| a | b |\n| - | - |\n| 1 | 2 |',
      `> A quote in section ${section}, with ==a highlight==.`,
      PARAGRAPH
    ].join('\n\n')
    parts.push(block)
    size += block.length + 2
  }
  return `# Large document\n\n${parts.join('\n\n')}\n`
}
