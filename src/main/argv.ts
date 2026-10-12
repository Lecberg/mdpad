import { statSync } from 'fs'
import { resolve } from 'path'

/**
 * Files passed on the command line ("Open with", drag onto the exe, `mdpad note.md`).
 * argv[0] is the executable; flags and directories (like `.` in dev) are skipped.
 */
export function filesFromArgv(argv: string[], cwd: string): string[] {
  return argv
    .slice(1)
    .filter((arg) => !arg.startsWith('-'))
    .map((arg) => resolve(cwd, arg))
    .filter((path) => {
      try {
        return statSync(path).isFile()
      } catch {
        return false
      }
    })
}
