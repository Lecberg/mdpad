import type { Mark, MarkType, ResolvedPos } from '@milkdown/kit/prose/model'

export interface MarkRange {
  from: number
  to: number
  mark: Mark
}

/**
 * The full extent of the `type` mark touching `$pos` (inside it, or directly before/after
 * it), within the position's textblock. Adjacent marks with different attributes (e.g. two
 * links with different URLs) are separate ranges.
 */
export function markRangeAt($pos: ResolvedPos, type: MarkType): MarkRange | null {
  const mark =
    type.isInSet($pos.nodeAfter?.marks ?? []) ?? type.isInSet($pos.nodeBefore?.marks ?? [])
  if (!mark) return null

  const parent = $pos.parent
  let pos = $pos.start()
  let from = -1
  let to = -1
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i)
    const end = pos + child.nodeSize
    if (mark.isInSet(child.marks)) {
      if (from < 0) from = pos
      to = end
    } else if (from >= 0) {
      if (to >= $pos.pos) break
      from = to = -1
    }
    pos = end
  }
  if (from < 0 || $pos.pos < from || $pos.pos > to) return null
  return { from, to, mark }
}
