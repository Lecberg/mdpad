// Windows path helpers for the renderer (which has no access to Node's `path`).

const normalize = (path: string): string => path.replace(/\//g, '\\').replace(/\\+$/, '')

export const samePath = (a: string | null, b: string | null): boolean =>
  a !== null && b !== null && normalize(a).toLowerCase() === normalize(b).toLowerCase()

export function baseName(path: string): string {
  return normalize(path).split('\\').pop() ?? path
}

export function dirName(path: string): string {
  const parts = normalize(path).split('\\')
  parts.pop()
  return parts.join('\\')
}

/** `path` is `folder` itself or inside it. */
export function isInside(folder: string, path: string): boolean {
  const f = normalize(folder).toLowerCase()
  const p = normalize(path).toLowerCase()
  return p === f || p.startsWith(f + '\\')
}

/** `path` relative to `folder` with "/" separators, or the full path if it is outside. */
export function relativeTo(folder: string, path: string): string {
  if (!isInside(folder, path)) return path
  return normalize(path)
    .slice(normalize(folder).length + 1)
    .replace(/\\/g, '/')
}

/** The folders between `folder` (exclusive) and `path` (exclusive), outermost first. */
export function ancestorsWithin(folder: string, path: string): string[] {
  if (!isInside(folder, path)) return []
  const result: string[] = []
  for (
    let dir = dirName(path);
    isInside(folder, dir) && !samePath(dir, folder);
    dir = dirName(dir)
  ) {
    result.unshift(dir)
  }
  return result
}

const MARKDOWN_EXTENSIONS = /\.(md|markdown|mdown|mkd|txt)$/i

export const isMarkdownName = (name: string): boolean => MARKDOWN_EXTENSIONS.test(name)

export const extensionOf = (name: string): string => /\.[^.\\/]+$/.exec(name)?.[0] ?? ''
