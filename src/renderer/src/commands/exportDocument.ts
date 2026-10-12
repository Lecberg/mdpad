import { mermaidSvg } from '../editor/previews'
import { pathToFileUrl } from '../editor/imageUrl'
import { buildExportHtml, documentTitle } from '../export/buildHtml'
import { baseName, dirName } from '../lib/paths'
import { documentStore } from '../state/documentStore'
import { showStatusMessage } from '../state/uiStore'
import { currentFileText } from './runCommand'

/** File › Export as HTML / PDF. */
export async function exportDocument(kind: 'html' | 'pdf'): Promise<void> {
  const markdown = currentFileText()
  const { path } = documentStore.get()
  const name = path ? baseName(path).replace(/\.[^.]+$/, '') : 'Untitled'
  const folder = path ? dirName(path) : null
  showStatusMessage(kind === 'pdf' ? 'Preparing PDF…' : 'Preparing HTML…')
  const html = await buildExportHtml(markdown, {
    title: documentTitle(markdown, name),
    // A PDF is printed from a temporary copy, so relative images need the document's folder.
    baseHref: kind === 'pdf' && folder ? `${pathToFileUrl(folder)}/` : null,
    renderDiagram: (source) => mermaidSvg(source, false),
    embedFonts: true
  })
  const defaultPath = `${folder ? `${folder}\\` : ''}${name}.${kind}`
  const result = await window.api.exportDocument(kind, html, defaultPath)
  if (result.ok) {
    showStatusMessage(`Exported to ${baseName(result.path)}`)
  } else {
    showStatusMessage(null)
    if (result.error) window.alert(`Could not export the document.\n\n${result.error}`)
  }
}
