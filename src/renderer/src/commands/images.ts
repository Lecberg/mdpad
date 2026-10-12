import { documentStore } from '../state/documentStore'
import { saveDocument } from './runCommand'

/**
 * Store pasted/dropped images next to the document and return their Markdown srcs (null
 * where one failed). An untitled document must be saved first, so there's a folder to use.
 */
export async function saveImages(files: File[]): Promise<Array<string | null>> {
  if (!documentStore.get().path) {
    const proceed = window.confirm(
      'Images are stored next to the document. Save the document now to add this image?'
    )
    if (!proceed || !(await saveDocument({ saveAs: true }))) return files.map(() => null)
  }

  const results: Array<string | null> = []
  let firstError: string | null = null
  for (const file of files) {
    try {
      const result = await window.api.saveImage(file.type, new Uint8Array(await file.arrayBuffer()))
      results.push(result.ok ? result.src : null)
      if (!result.ok) firstError ??= result.error
    } catch (error) {
      results.push(null)
      firstError ??= String(error)
    }
  }
  if (firstError) window.alert(`Could not save the image.\n\n${firstError}`)
  return results
}
