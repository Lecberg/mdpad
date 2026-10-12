import type { DocState } from '../state/documentStore'
import { applyFinalNewline, mergeEdits } from './preserveFormatting'

type SaveInput = Pick<DocState, 'original' | 'baseline' | 'current'>

/**
 * The LF text to write for a visual-mode document whose editor serializes to `markdown`.
 * If the editor content is unchanged, that is exactly `original`.
 */
export function textToSave(
  doc: SaveInput,
  markdown: string,
  normalize: (markdown: string) => string
): string {
  if (doc.baseline === null || markdown === doc.baseline) return doc.original
  const merged = mergeEdits(doc.original, doc.baseline, markdown, normalize)
  const finalNewline = doc.original === '' || doc.original.endsWith('\n')
  return applyFinalNewline(merged, finalNewline)
}
