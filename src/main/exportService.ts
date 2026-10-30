import { BrowserWindow, dialog } from 'electron'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { FsResult } from '../shared/ipc-types'
import type { PdfExportOptions } from '../shared/pdfExport'

// File > Export: the renderer builds a standalone HTML page; here it is saved as is, or
// printed to PDF from a hidden window with scripts disabled.

export type ExportKind = 'html' | 'pdf'

const FILTERS = {
  html: [{ name: 'HTML', extensions: ['html', 'htm'] }],
  pdf: [{ name: 'PDF', extensions: ['pdf'] }]
}

export async function printToPdf(
  html: string,
  options: PdfExportOptions = { scale: 1 }
): Promise<Buffer> {
  const page = join(tmpdir(), `mdpad-export-${randomUUID()}.html`)
  await fs.writeFile(page, html, 'utf8')
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, javascript: false }
  })
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  try {
    await win.loadFile(page)
    return await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      scale: options.scale
    })
  } finally {
    win.destroy()
    await fs.rm(page, { force: true })
  }
}

export async function exportDocument(
  parent: BrowserWindow,
  kind: ExportKind,
  html: string,
  defaultPath: string,
  pdfOptions: PdfExportOptions = { scale: 1 }
): Promise<FsResult> {
  const choice = await dialog.showSaveDialog(parent, { defaultPath, filters: FILTERS[kind] })
  if (choice.canceled || !choice.filePath) return { ok: false }
  try {
    const data = kind === 'pdf' ? await printToPdf(html, pdfOptions) : html
    await fs.writeFile(choice.filePath, data)
    return { ok: true, path: choice.filePath }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}
