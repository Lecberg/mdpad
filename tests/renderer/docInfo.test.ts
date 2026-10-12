import { describe, expect, it } from 'vitest'
import {
  activeHeadingIndex,
  countCharacters,
  countWords,
  outlineFromSource
} from '@renderer/state/docInfoStore'
import { slugify } from '@renderer/editor/links'

describe('outlineFromSource', () => {
  it('finds ATX headings with their offsets', () => {
    const text = '# One\n\ntext\n\n## Two ##\n'
    expect(outlineFromSource(text)).toEqual([
      { level: 1, text: 'One', target: 0 },
      { level: 2, text: 'Two', target: 13 }
    ])
  })

  it('ignores # lines inside fenced code', () => {
    const text = '```sh\n# not a heading\n```\n~~~\n# nor this\n~~~\n# Real\n'
    expect(outlineFromSource(text).map((h) => h.text)).toEqual(['Real'])
  })

  it('requires a space after the hashes', () => {
    expect(outlineFromSource('#hashtag\n')).toEqual([])
  })
})

describe('activeHeadingIndex', () => {
  const outline = [
    { level: 1, text: 'a', target: 0 },
    { level: 2, text: 'b', target: 50 }
  ]
  it('picks the last heading at or before the position', () => {
    expect(activeHeadingIndex(outline, 10)).toBe(0)
    expect(activeHeadingIndex(outline, 50)).toBe(1)
    expect(activeHeadingIndex([{ level: 1, text: 'a', target: 5 }], 0)).toBe(-1)
  })
})

describe('word count', () => {
  it('counts Latin words', () => {
    expect(countWords("Hello world, it's 2026.")).toBe(4)
  })

  it('counts each CJK character as a word', () => {
    expect(countWords('学而时习之')).toBe(5)
    expect(countWords('混合 English 和中文')).toBe(6)
  })

  it('counts non-space characters', () => {
    expect(countCharacters('a b\n中文')).toBe(4)
  })
})

describe('slugify', () => {
  it('matches common heading anchors', () => {
    expect(slugify('Second Level')).toBe('second-level')
    expect(slugify('What is M2?')).toBe('what-is-m2')
    expect(slugify('中文 标题')).toBe('中文-标题')
  })
})
