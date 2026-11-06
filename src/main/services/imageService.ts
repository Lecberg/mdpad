import { promises as fs } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { IMAGE_MIME_EXTENSIONS, imageBytesProblem } from '../../shared/imageBytes'

export { IMAGE_MIME_EXTENSIONS }

const pad = (n: number): string => String(n).padStart(2, '0')

/** "20261012-153045" in local time. */
export function timestamp(date: Date): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

/**
 * Save image bytes into "<doc name>.assets/" next to the document (Typora's convention) and
 * return the Markdown src relative to the document, e.g. "notes.assets/image-20261012-1530.png".
 * Never overwrites: a numeric suffix is added if the name is taken.
 */
export async function saveImageNextTo(
  docPath: string,
  mimeType: string,
  bytes: Uint8Array,
  now = new Date()
): Promise<string> {
  const problem = imageBytesProblem(mimeType, bytes)
  if (problem) throw new Error(problem)

  const ext = IMAGE_MIME_EXTENSIONS[mimeType]
  if (!ext) throw new Error(`Unsupported image type: ${mimeType || 'unknown'}`)

  const assetsDir = `${basename(docPath, extname(docPath))}.assets`
  const target = join(dirname(docPath), assetsDir)
  await fs.mkdir(target, { recursive: true })

  const stem = `image-${timestamp(now)}`
  for (let n = 0; ; n++) {
    const name = `${stem}${n === 0 ? '' : `-${n}`}.${ext}`
    try {
      await fs.writeFile(join(target, name), bytes, { flag: 'wx' })
      return `${assetsDir}/${name}`
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
}
