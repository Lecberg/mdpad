// Images in Markdown are usually relative to the document ("photo.png", "../img/a.png").
// The renderer page can't load local files directly, so local images are served through
// the app's `mdpad-file://` protocol (see main/protocol.ts).

export const LOCAL_FILE_SCHEME = 'mdpad-file'

/** file:// URL for a Windows or POSIX path, with each segment percent-encoded. */
export function pathToFileUrl(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/')
  const encoded = segments.map((s, i) =>
    i === 0 && /^[a-z]:$/i.test(s) ? s : encodeURIComponent(s)
  )
  const joined = encoded.join('/')
  return joined.startsWith('/') ? `file://${joined}` : `file:///${joined}`
}

/**
 * The URL an <img> should load for Markdown `src` in a document at `docPath`.
 * Web, data and blob URLs pass through; local paths go through the app protocol.
 * Returns null for a relative path in an unsaved document (nothing to resolve against).
 */
export function imageDisplayUrl(src: string, docPath: string | null): string | null {
  const trimmed = src.trim()
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed

  let fileUrl: URL
  try {
    if (/^file:/i.test(trimmed)) fileUrl = new URL(trimmed)
    else if (/^[a-z]:[\\/]/i.test(trimmed) || trimmed.startsWith('\\\\')) {
      fileUrl = new URL(pathToFileUrl(trimmed))
    } else {
      if (!docPath) return null
      fileUrl = new URL(trimmed.replace(/\\/g, '/'), pathToFileUrl(docPath))
    }
  } catch {
    return null
  }
  return `${LOCAL_FILE_SCHEME}://local${fileUrl.pathname}`
}
