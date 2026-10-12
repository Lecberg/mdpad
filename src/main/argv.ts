import { statSync } from 'fs'
import { resolve } from 'path'

export interface ArgvPaths {
  files: string[]
  folders: string[]
}

/**
 * Files and folders passed on the command line ("Open with", drag onto the exe,
 * `mdpad notes\`). argv[0] is the executable; flags and missing paths are skipped, as is
 * `appPath` (in development the app folder itself is passed to Electron as `.`).
 */
export function pathsFromArgv(argv: string[], cwd: string, appPath?: string): ArgvPaths {
  const result: ArgvPaths = { files: [], folders: [] }
  const skip = appPath ? resolve(appPath).toLowerCase() : null
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('-')) continue
    const path = resolve(cwd, arg)
    if (path.toLowerCase() === skip) continue
    try {
      const info = statSync(path)
      if (info.isFile()) result.files.push(path)
      else if (info.isDirectory()) result.folders.push(path)
    } catch {
      // missing: ignore
    }
  }
  return result
}
