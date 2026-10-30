import type { PdfExportOptions } from '../../../shared/pdfExport'
import { LOCAL_FILE_SCHEME, pathToFileUrl } from '../editor/imageUrl'
import { mermaidSvg } from '../editor/previews'
import { buildExportHtml, documentTitle } from '../export/buildHtml'
import type { HtmlLayout } from '../export/htmlLayout'
import { baseName, dirName } from '../lib/paths'
import { documentStore } from '../state/documentStore'
import { showStatusMessage } from '../state/uiStore'
import { currentFileText } from './runCommand'

/** The document an export is made from, captured when its dialog opens. */
export interface ExportSource {
  markdown: string
  /** File name without its extension, or "Untitled". */
  name: string
  folder: string | null
}

export function captureExportSource(): ExportSource {
  const markdown = currentFileText()
  const { path } = documentStore.get()
  return {
    markdown,
    name: path ? baseName(path).replace(/\.[^.]+$/, '') : 'Untitled',
    folder: path ? dirName(path) : null
  }
}

/**
 * Where the document's relative images are loaded from:
 * - 'html': the saved file keeps relative paths, so none is set;
 * - 'html-preview': the preview loads them through the app's image protocol;
 * - 'pdf': the PDF is printed from a temporary copy, so the document's folder is the base.
 */
export type ExportTarget = 'html' | 'html-preview' | 'pdf'

function baseHref(target: ExportTarget, folder: string | null): string | null {
  if (!folder) return null
  if (target === 'pdf') return `${pathToFileUrl(folder)}/`
  if (target === 'html-preview') {
    return `${pathToFileUrl(folder).replace(/^file:\/\/\//, `${LOCAL_FILE_SCHEME}://local/`)}/`
  }
  return null
}

export function renderExportHtml(
  source: ExportSource,
  target: ExportTarget,
  layout?: HtmlLayout
): Promise<string> {
  return buildExportHtml(source.markdown, {
    title: documentTitle(source.markdown, source.name),
    baseHref: baseHref(target, source.folder),
    renderDiagram: (text) => mermaidSvg(text, false),
    embedFonts: true,
    layout
  })
}

/** Ask where to save the export, then write it. */
export async function saveExport(
  kind: 'html' | 'pdf',
  source: ExportSource,
  html: string,
  pdfOptions?: PdfExportOptions
): Promise<void> {
  const defaultPath = `${source.folder ? `${source.folder}\\` : ''}${source.name}.${kind}`
  const result = await window.api.exportDocument(kind, html, defaultPath, pdfOptions)
  if (result.ok) {
    showStatusMessage(`Exported to ${baseName(result.path)}`)
  } else {
    showStatusMessage(null)
    if (result.error) window.alert(`Could not export the document.\n\n${result.error}`)
  }
}
