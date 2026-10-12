import { watch } from 'fs'
import { basename, dirname } from 'path'

/**
 * Call `onChange` (debounced) when `path` changes on disk. Watches the folder rather than
 * the file, so it keeps working when other editors save by replacing the file.
 */
export function watchFile(path: string, onChange: () => void, delayMs = 150): () => void {
  const name = basename(path).toLowerCase()
  let timer: ReturnType<typeof setTimeout> | undefined
  let watcher: ReturnType<typeof watch>
  try {
    watcher = watch(dirname(path), (_event, filename) => {
      if (filename && filename.toString().toLowerCase() !== name) return
      clearTimeout(timer)
      timer = setTimeout(onChange, delayMs)
    })
  } catch {
    return () => {}
  }
  watcher.on('error', () => watcher.close())
  return () => {
    clearTimeout(timer)
    watcher.close()
  }
}
