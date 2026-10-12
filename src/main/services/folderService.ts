import { promises as fs, type Dirent } from 'fs'
import { extname, isAbsolute, join, relative, resolve } from 'path'
import type {
  FolderSnapshot,
  SearchFileResult,
  SearchMatch,
  SearchResult,
  TreeNode
} from '../../shared/ipc-types'

// Folder mode: listing a folder's Markdown files, searching them, and checking names and
// paths for the file tree's create/rename/delete operations.

export const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.txt'])

export const isMarkdownPath = (path: string): boolean =>
  MARKDOWN_EXTENSIONS.has(extname(path).toLowerCase())

/** Folders never worth showing: hidden ones (.git, .obsidian…) and dependency folders. */
export const isSkippedName = (name: string): boolean =>
  name.startsWith('.') || name === 'node_modules' || name === '$RECYCLE.BIN'

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export interface ScanLimits {
  maxEntries: number
  maxDepth: number
}

const DEFAULT_LIMITS: ScanLimits = { maxEntries: 20000, maxDepth: 16 }

/** All sub-folders and Markdown files under `root`, folders first, in natural order. */
export async function scanFolder(
  root: string,
  limits: ScanLimits = DEFAULT_LIMITS
): Promise<FolderSnapshot> {
  let entries = 0
  let truncated = false

  async function list(dir: string, depth: number): Promise<TreeNode[]> {
    let dirents: Dirent[]
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return []
    }
    const dirs: TreeNode[] = []
    const files: TreeNode[] = []
    for (const d of dirents) {
      if (isSkippedName(d.name)) continue
      if (entries >= limits.maxEntries) {
        truncated = true
        break
      }
      const path = join(dir, d.name)
      if (d.isDirectory()) {
        entries++
        dirs.push({ name: d.name, path, kind: 'dir', children: [] })
      } else if (d.isFile() && isMarkdownPath(d.name)) {
        entries++
        files.push({ name: d.name, path, kind: 'file' })
      }
    }
    dirs.sort((a, b) => collator.compare(a.name, b.name))
    files.sort((a, b) => collator.compare(a.name, b.name))
    if (depth < limits.maxDepth) {
      for (const node of dirs) node.children = await list(node.path, depth + 1)
    } else if (dirs.length > 0) {
      truncated = true
    }
    return [...dirs, ...files]
  }

  const children = await list(root, 1)
  return { root, children, truncated }
}

export function flattenFiles(nodes: TreeNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.kind === 'file') out.push(node.path)
    else if (node.children) flattenFiles(node.children, out)
  }
  return out
}

/** `path` is `root` itself or somewhere inside it (case-insensitive, as on Windows). */
export function isInsideFolder(root: string, path: string): boolean {
  const rel = relative(resolve(root).toLowerCase(), resolve(path).toLowerCase())
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

const RESERVED_NAMES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i

/** Why `name` can't be used as a file or folder name on Windows, or null if it can. */
export function invalidNameReason(name: string): string | null {
  if (!name.trim()) return 'Enter a name.'
  if (name === '.' || name === '..') return 'That name is reserved.'
  // eslint-disable-next-line no-control-regex
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(name)) {
    return 'A name can’t contain any of these characters: \\ / : * ? " < > |'
  }
  if (/[. ]$/.test(name)) return 'A name can’t end with a space or a period.'
  if (RESERVED_NAMES.test(name)) return 'That name is reserved by Windows.'
  if (name.length > 255) return 'That name is too long.'
  return null
}

const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_MATCHES_PER_FILE = 100
const PREVIEW_CONTEXT = 40
const PREVIEW_LENGTH = 160

function preview(
  line: string,
  start: number,
  end: number
): Pick<SearchMatch, 'preview' | 'previewStart' | 'previewEnd'> {
  let from = 0
  if (line.length > PREVIEW_LENGTH && start > PREVIEW_CONTEXT) from = start - PREVIEW_CONTEXT
  const to = Math.min(line.length, Math.max(from + PREVIEW_LENGTH, end))
  const prefix = from > 0 ? '…' : ''
  const text = prefix + line.slice(from, to) + (to < line.length ? '…' : '')
  return {
    preview: text,
    previewStart: prefix.length + start - from,
    previewEnd: prefix.length + end - from
  }
}

/** Every occurrence of `query` (plain text) in `text`. */
export function findInText(text: string, query: string, matchCase: boolean): SearchMatch[] {
  if (!query) return []
  const needle = matchCase ? query : query.toLowerCase()
  const matches: SearchMatch[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length && matches.length < MAX_MATCHES_PER_FILE; i++) {
    const line = lines[i]
    // Only compare case-folded text when the folding keeps lengths (true for almost all
    // text); otherwise fall back to an exact comparison so columns stay correct.
    const folded = matchCase ? line : line.toLowerCase()
    const haystack = folded.length === line.length ? folded : line
    for (
      let col = haystack.indexOf(needle);
      col >= 0 && matches.length < MAX_MATCHES_PER_FILE;
      col = haystack.indexOf(needle, col + needle.length)
    ) {
      matches.push({
        line: i + 1,
        column: col,
        occurrence: matches.length,
        ...preview(line, col, col + needle.length)
      })
    }
  }
  return matches
}

/** Search the given files for `query`, reading a few at a time. */
export async function searchFiles(
  files: string[],
  query: string,
  matchCase: boolean,
  maxMatches = 2000
): Promise<SearchResult> {
  const results: SearchFileResult[] = []
  let total = 0
  let truncated = false
  const BATCH = 16
  for (let i = 0; i < files.length && !truncated; i += BATCH) {
    const batch = files.slice(i, i + BATCH)
    const texts = await Promise.all(
      batch.map(async (path) => {
        try {
          const info = await fs.stat(path)
          if (info.size > MAX_FILE_BYTES) return null
          return (await fs.readFile(path, 'utf8')).replace(/^\uFEFF/, '')
        } catch {
          return null
        }
      })
    )
    batch.forEach((path, index) => {
      const text = texts[index]
      if (text === null || truncated) return
      const matches = findInText(text, query, matchCase)
      if (matches.length === 0) return
      if (total + matches.length > maxMatches) {
        matches.length = maxMatches - total
        truncated = true
      }
      total += matches.length
      if (matches.length > 0) results.push({ path, matches })
    })
  }
  return { files: results, total, truncated }
}
