import { promises as fs } from 'fs'
import { dirname } from 'path'

/** Parsed JSON from `path`, or undefined if it is missing or unreadable. */
export async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'))
  } catch {
    return undefined
  }
}

/** Write JSON via a temp file and rename, so a crash never leaves a half-written file. */
export async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, path)
}

/** Runs writes one after another, so an older write can never land after a newer one. */
export class WriteQueue {
  private last: Promise<void> = Promise.resolve()

  run(task: () => Promise<void>): Promise<void> {
    this.last = this.last.then(task).catch((error) => console.error(error))
    return this.last
  }
}
