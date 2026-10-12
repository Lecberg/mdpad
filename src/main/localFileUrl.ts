export const LOCAL_FILE_SCHEME = 'mdpad-file'

/** Convert an mdpad-file URL to a local path, or null if it is not one. */
export function localPathFromUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${LOCAL_FILE_SCHEME}:`) return null
  let path = decodeURIComponent(parsed.pathname)
  if (/^\/[a-z]:\//i.test(path)) path = path.slice(1) // "/C:/x" -> "C:/x"
  return path
}
