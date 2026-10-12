// Fuzzy matching for Quick Open: the query's characters must appear in order; matches at
// the start of words and in the file name score higher, gaps score lower.

export interface FuzzyMatch {
  score: number
  /** Indices of the matched characters in the candidate text. */
  indices: number[]
}

const isBoundary = (text: string, i: number): boolean =>
  i === 0 || /[\\/\s_\-.]/.test(text[i - 1]) || (/[a-z]/.test(text[i - 1]) && /[A-Z]/.test(text[i]))

export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.replace(/\s+/g, '').toLowerCase()
  if (!q) return { score: 0, indices: [] }
  const t = text.toLowerCase()
  const nameStart = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\')) + 1

  // Greedy forward match, then pull each matched character as late as possible within its
  // gap so that consecutive runs (e.g. a whole word in the file name) are preferred.
  const indices: number[] = []
  let from = 0
  for (const ch of q) {
    const i = t.indexOf(ch, from)
    if (i < 0) return null
    indices.push(i)
    from = i + 1
  }
  for (let k = indices.length - 2; k >= 0; k--) {
    const limit = indices[k + 1]
    const last = t.lastIndexOf(q[k], limit - 1)
    if (last > indices[k] && (indices[k + 1] === last + 1 || isBoundary(text, last))) {
      indices[k] = last
    }
  }

  let score = 0
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k]
    score += 1
    if (k > 0 && indices[k - 1] === i - 1) score += 5
    if (isBoundary(text, i)) score += 8
    if (i >= nameStart) score += 3
    if (k > 0) score -= Math.min(3, (i - indices[k - 1] - 1) * 0.2)
  }
  if (t.slice(nameStart).startsWith(q)) score += 10
  score -= text.length * 0.02
  return { score, indices }
}

export interface Ranked<T> {
  item: T
  match: FuzzyMatch
}

/** Items matching `query`, best first (ties keep the input order). */
export function rankFuzzy<T>(items: T[], query: string, textOf: (item: T) => string): Ranked<T>[] {
  const ranked: Array<Ranked<T> & { order: number }> = []
  items.forEach((item, order) => {
    const match = fuzzyMatch(query, textOf(item))
    if (match) ranked.push({ item, match, order })
  })
  return ranked.sort((a, b) => b.match.score - a.match.score || a.order - b.order)
}
