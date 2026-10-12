import { useSyncExternalStore } from 'react'
import type { Node } from '@milkdown/kit/prose/model'

// Live facts about the open document for the outline and status bar. Both editors push
// updates here (throttled), so the UI works the same in visual and source mode.

export interface OutlineItem {
  level: number
  text: string
  /** Visual mode: position before the heading node. Source mode: character offset. */
  target: number
}

export interface DocInfo {
  outline: OutlineItem[]
  /** Index into `outline` of the heading the caret is in or below; -1 if none. */
  activeHeading: number
  words: number
  characters: number
}

let state: DocInfo = { outline: [], activeHeading: -1, words: 0, characters: 0 }
const listeners = new Set<() => void>()

export const docInfoStore = {
  get: (): DocInfo => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  set(patch: Partial<DocInfo>): void {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }
}

export function useDocInfo(): DocInfo {
  return useSyncExternalStore(docInfoStore.subscribe, docInfoStore.get)
}

/** Top-level headings of a visual-mode document. */
export function outlineFromDoc(doc: Node): OutlineItem[] {
  const items: OutlineItem[] = []
  doc.forEach((node, offset) => {
    if (node.type.name === 'heading') {
      items.push({ level: node.attrs.level as number, text: node.textContent, target: offset })
    }
  })
  return items
}

/** ATX headings in Markdown source, skipping fenced code blocks. */
export function outlineFromSource(text: string): OutlineItem[] {
  const items: OutlineItem[] = []
  let fence: string | null = null
  let offset = 0
  for (const line of text.split('\n')) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (fence === null) fence = marker
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null
    } else if (fence === null) {
      const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(line)
      if (heading) {
        items.push({ level: heading[1].length, text: heading[2] ?? '', target: offset })
      }
    }
    offset += line.length + 1
  }
  return items
}

/** Index of the last outline item at or before `position` (a target-comparable value). */
export function activeHeadingIndex(outline: OutlineItem[], position: number): number {
  let index = -1
  for (let i = 0; i < outline.length && outline[i].target <= position; i++) index = i
  return index
}

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g
const WORD = /[A-Za-z0-9À-ɏ]+(?:['’][A-Za-zÀ-ɏ]+)*/g

/** Words as Typora counts them: each CJK character is a word, plus runs of Latin letters/digits. */
export function countWords(text: string): number {
  const cjk = text.match(CJK)?.length ?? 0
  const latin = text.replace(CJK, ' ').match(WORD)?.length ?? 0
  return cjk + latin
}

export function countCharacters(text: string): number {
  return [...text.replace(/\s/g, '')].length
}
