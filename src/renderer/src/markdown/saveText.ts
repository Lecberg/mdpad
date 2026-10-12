import type { DocState } from '../state/documentStore'
import { applyFinalNewline, mergeEdits } from './preserveFormatting'

type SaveInput = Pick<DocState, 'original' | 'baseline' | 'dirty' | 'format'>

/**
 * The LF text to write for a document whose editor currently serializes to `markdown`.
 * An unedited document is written back exactly as it was read.
 */
export function textToSave(
  doc: SaveInput,
  markdown: string,
  normalize: (markdown: string) => string
): string {
  if (!doc.dirty || doc.baseline === null) return doc.original
  const merged = mergeEdits(doc.original, doc.baseline, markdown, normalize)
  return applyFinalNewline(merged, doc.format.finalNewline)
}
