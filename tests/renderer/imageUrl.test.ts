import { describe, expect, it } from 'vitest'
import { imageDisplayUrl, pathToFileUrl } from '@renderer/editor/imageUrl'

const doc = 'C:\\Users\\me\\Notes\\week 1.md'

describe('imageDisplayUrl', () => {
  it('passes web and data URLs through', () => {
    expect(imageDisplayUrl('https://x.dev/a.png', doc)).toBe('https://x.dev/a.png')
    expect(imageDisplayUrl('data:image/png;base64,AAA', doc)).toBe('data:image/png;base64,AAA')
  })

  it('resolves relative paths against the document folder', () => {
    expect(imageDisplayUrl('week 1.assets/image.png', doc)).toBe(
      'mdpad-file://local/C:/Users/me/Notes/week%201.assets/image.png'
    )
    expect(imageDisplayUrl('../img/a.png', doc)).toBe('mdpad-file://local/C:/Users/me/img/a.png')
    expect(imageDisplayUrl('./a%20b.png', doc)).toBe(
      'mdpad-file://local/C:/Users/me/Notes/a%20b.png'
    )
  })

  it('accepts absolute Windows paths and file URLs', () => {
    expect(imageDisplayUrl('D:\\pics\\x.jpg', doc)).toBe('mdpad-file://local/D:/pics/x.jpg')
    expect(imageDisplayUrl('file:///D:/pics/x.jpg', doc)).toBe('mdpad-file://local/D:/pics/x.jpg')
  })

  it('cannot resolve relative paths in an unsaved document', () => {
    expect(imageDisplayUrl('a.png', null)).toBeNull()
  })
})

describe('pathToFileUrl', () => {
  it('encodes special characters per segment', () => {
    expect(pathToFileUrl('C:\\a #1\\b?.md')).toBe('file:///C:/a%20%231/b%3F.md')
  })
})
