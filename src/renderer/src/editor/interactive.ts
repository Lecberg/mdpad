import { languages } from '@codemirror/language-data'
import { EditorView as CodeView } from '@codemirror/view'
import type { Editor } from '@milkdown/kit/core'
import { codeBlockComponent, codeBlockConfig } from '@milkdown/kit/component/code-block'
import { tableBlock, tableBlockConfig, type RenderType } from '@milkdown/kit/component/table-block'
import { upload, uploadConfig } from '@milkdown/kit/plugin/upload'
import type { Node } from '@milkdown/kit/prose/model'
import { Decoration } from '@milkdown/kit/prose/view'
import { codeHighlighting } from './codeHighlight'
import { imageView } from './plugins/imageView'
import { previewFocus } from './plugins/previewFocus'
import { focusPath, largeDocument, typewriter } from './plugins/writingModes'
import { renderPreview } from './previews'

export interface InteractiveOptions {
  /**
   * Store pasted or dropped image files next to the document and return the Markdown src
   * for each (or null if one could not be saved). Must not throw.
   */
  saveImages: (files: File[]) => Promise<Array<string | null>>
}

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${body}</svg>`

const ICONS: Record<RenderType, string> = {
  add_row: svg('<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>'),
  add_col: svg('<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>'),
  delete_row: svg('<path d="M7 4h10l-1 16H8zM5 4h14v2H5zM10 2h4v2h-4z"/>'),
  delete_col: svg('<path d="M7 4h10l-1 16H8zM5 4h14v2H5zM10 2h4v2h-4z"/>'),
  align_col_left: svg('<path d="M4 5h16v2H4zm0 4h10v2H4zm0 4h16v2H4zm0 4h10v2H4z"/>'),
  align_col_center: svg('<path d="M4 5h16v2H4zm3 4h10v2H7zm-3 4h16v2H4zm3 4h10v2H7z"/>'),
  align_col_right: svg('<path d="M4 5h16v2H4zm6 4h10v2H10zm-6 4h16v2H4zm6 4h10v2H10z"/>'),
  col_drag_handle: svg('<path d="M6 10h2v4H6zm5 0h2v4h-2zm5 0h2v4h-2z"/>'),
  row_drag_handle: svg('<path d="M10 6h4v2h-4zm0 5h4v2h-4zm0 5h4v2h-4z"/>')
}

const IMAGE_TYPE = /^image\//

export function addInteractiveViews(editor: Editor, options: InteractiveOptions): Editor {
  return editor
    .config((ctx) => {
      ctx.update(codeBlockConfig.key, (prev) => ({
        ...prev,
        languages,
        extensions: [codeHighlighting, CodeView.lineWrapping],
        searchPlaceholder: 'Search language',
        noResultText: 'No matching language',
        expandIcon: svg('<path d="M7 10l5 5 5-5z"/>'),
        searchIcon: '',
        clearSearchIcon: '×',
        copyIcon: '',
        copyText: 'Copy',
        onCopy: (text) => void navigator.clipboard.writeText(text),
        renderLanguage: (language) => language || 'plain text',
        renderPreview,
        previewLabel: 'Preview',
        previewLoading: 'Rendering…',
        previewToggleButton: () => ''
      }))
      ctx.update(tableBlockConfig.key, (prev) => ({
        ...prev,
        renderButton: (type) => ICONS[type]
      }))
      ctx.update(uploadConfig.key, (prev) => ({
        ...prev,
        enableHtmlFileUploader: true,
        uploadWidgetFactory: (pos, spec) => {
          const widget = document.createElement('span')
          widget.className = 'md-upload-placeholder'
          widget.textContent = 'Saving image…'
          return Decoration.widget(pos, widget, spec)
        },
        uploader: async (files, schema) => {
          const images = Array.from(files).filter((file) => IMAGE_TYPE.test(file.type))
          if (images.length === 0) return []
          const sources = await options.saveImages(images)
          return sources.flatMap((src): Node[] => {
            const node = src ? schema.nodes.image.createAndFill({ src, alt: '' }) : null
            return node ? [node] : []
          })
        }
      }))
    })
    .use(codeBlockComponent)
    .use(tableBlock)
    .use(imageView)
    .use(previewFocus)
    .use(focusPath)
    .use(typewriter)
    .use(largeDocument)
    .use(upload)
}
