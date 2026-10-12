import { promises as fs } from 'fs'
import { basename, dirname, join } from 'path'
import type { LoadedFile, TextFormat } from '../../shared/ipc-types'

const BOM = '﻿'

/** Split raw file contents into LF-only text plus the format needed to write it back. */
export function decodeText(raw: Buffer | string): { text: string } & TextFormat {
  let text = typeof raw === 'string' ? raw : raw.toString('utf8')
  const bom = text.startsWith(BOM)
  if (bom) text = text.slice(1)

  const crlf = (text.match(/\r\n/g) ?? []).length
  const lf = (text.match(/\n/g) ?? []).length - crlf
  const eol = crlf > 0 && crlf >= lf ? '\r\n' : '\n'

  return { text: text.replace(/\r\n/g, '\n'), eol, bom }
}

/** Inverse of decodeText: apply line endings and BOM to LF-only text. */
export function encodeText(text: string, format: TextFormat): string {
  const body = format.eol === '\r\n' ? text.replace(/\r?\n/g, '\r\n') : text
  return format.bom ? BOM + body : body
}

export async function readTextFile(path: string): Promise<LoadedFile> {
  const raw = await fs.readFile(path)
  return { path, ...decodeText(raw) }
}

/**
 * Write via a temp file in the same directory, then rename over the target, so a crash
 * mid-write never leaves a truncated document behind.
 */
export async function writeTextFile(path: string, text: string, format: TextFormat): Promise<void> {
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`)
  await fs.writeFile(tmp, encodeText(text, format), 'utf8')
  try {
    await renameWithRetry(tmp, path)
  } catch (error) {
    await fs.rm(tmp, { force: true })
    throw error
  }
}

// On Windows, antivirus or indexers can briefly lock the target file (EPERM/EBUSY).
async function renameWithRetry(from: string, to: string, attempts = 5): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await fs.rename(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (i >= attempts || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw error
      await new Promise((resolve) => setTimeout(resolve, 50 * i))
    }
  }
}
