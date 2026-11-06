// Rules for images pasted or dropped into a document. The main process is the authority;
// the renderer imports the size limit so an oversized file is never sent over IPC.

export const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/avif': 'avif'
}

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
export const MAX_IMAGE_MB = MAX_IMAGE_BYTES / (1024 * 1024)

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length))

/** The image type the bytes actually are, or null if they are not a supported image. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (!(bytes instanceof Uint8Array)) return null
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (bytes.length >= 6 && (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')) {
    return 'image/gif'
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'image/webp'
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp'
  if (
    bytes.length >= 12 &&
    ascii(bytes, 4, 4) === 'ftyp' &&
    (ascii(bytes, 8, 4) === 'avif' || ascii(bytes, 8, 4) === 'avis')
  ) {
    return 'image/avif'
  }
  return null
}

/**
 * Why `bytes` can't be saved as `mimeType`, or null if they can. SVG is rejected because
 * the file would be written next to the document and can run scripts when opened.
 */
export function imageBytesProblem(mimeType: string, bytes: Uint8Array): string | null {
  if (mimeType === 'image/svg+xml') {
    return 'SVG images can’t be pasted because they can run scripts. Save the SVG next to the document and link to it instead.'
  }
  if (!IMAGE_MIME_EXTENSIONS[mimeType]) {
    return `Unsupported image type: ${mimeType || 'unknown'}`
  }
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    return 'The pasted image is empty.'
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    return `Images must be smaller than ${MAX_IMAGE_MB} MB.`
  }
  const sniffed = sniffImageMime(bytes)
  if (!sniffed) return 'The file isn’t a supported image.'
  if (sniffed !== mimeType) return 'The image content doesn’t match its file type.'
  return null
}
