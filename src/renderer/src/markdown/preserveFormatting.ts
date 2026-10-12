import { diff3Merge } from 'node-diff3'

// A WYSIWYG editor re-serializes the whole document, which rewrites syntax the user never
// touched (setext headings, `*` bullets, reference links...). To keep a file's diff limited
// to what was actually edited, saving is a three-way merge:
//
//   original  — the text on disk
//   baseline  — what the editor serialized right after loading `original`
//   current   — what the editor serializes now
//
// The user's edits are the changes from baseline to current. Applying only those to the
// original keeps every untouched line byte-for-byte. Where an edit overlaps a line the
// editor would normalize anyway, the edited (normalized) version wins.

export function ensureFinalNewline(text: string): string {
  return text === '' || text.endsWith('\n') ? text : text + '\n'
}

export function applyFinalNewline(text: string, finalNewline: boolean): string {
  if (finalNewline) return ensureFinalNewline(text)
  return text.replace(/\n+$/, '')
}

const lines = (text: string): string[] => text.split('\n')

/**
 * Returns text to write for `current`, preserving untouched parts of `original`.
 * `normalize` (parse + serialize with the editor schema) verifies the merge: if the merged
 * text would not load back as the same document as `current`, the plain serialization is
 * used instead.
 */
export function mergeEdits(
  original: string,
  baseline: string,
  current: string,
  normalize: (markdown: string) => string
): string {
  const base = ensureFinalNewline(original)
  if (current === baseline) return base
  if (base === baseline) return current

  const merged: string[] = []
  for (const region of diff3Merge(lines(base), lines(baseline), lines(current), {
    excludeFalseConflicts: true
  })) {
    if (region.ok) merged.push(...region.ok)
    else if (region.conflict) merged.push(...region.conflict.b)
  }
  const result = merged.join('\n')

  // Compare normalized forms: `current` itself may not be a fixed point (an empty paragraph
  // serializes as extra blank lines that collapse on reload).
  return normalize(result) === normalize(current) ? result : current
}
