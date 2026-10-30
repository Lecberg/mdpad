import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { PDF_SCALE_PERCENT } from '../../../shared/pdfExport'
import { Icon } from '../app/icons'
import {
  captureExportSource,
  renderExportHtml,
  saveExport,
  type ExportSource,
  type ExportTarget
} from '../commands/exportDocument'
import { focusEditor } from '../editor/activeEditor'
import { showStatusMessage, uiStore, useUi } from '../state/uiStore'
import { DEFAULT_HTML_LAYOUT, HTML_LAYOUT_RANGE, type HtmlLayout } from './htmlLayout'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// File › Export as PDF / HTML: options on the left, a preview of the result on the right.
// The PDF preview is the real print, drawn page by page, so it matches the saved file. The
// HTML preview is the saved page itself, shown without scripts.

const PREVIEW_DELAY_MS = 300
/** The HTML preview is laid out at this width and scaled down to fit the pane. */
const HTML_PREVIEW_WIDTH = 1280

interface FieldSpec {
  /** How the field is named in messages, e.g. "scale". */
  noun: string
  unit: string
  min: number
  max: number
  step: number
  fallback: number
}

const SCALE_FIELD: FieldSpec = {
  noun: 'scale',
  unit: '%',
  min: PDF_SCALE_PERCENT.min,
  max: PDF_SCALE_PERCENT.max,
  step: PDF_SCALE_PERCENT.step,
  fallback: PDF_SCALE_PERCENT.default
}

const TEXT_WIDTH_FIELD: FieldSpec = {
  noun: 'text width',
  unit: 'px',
  ...HTML_LAYOUT_RANGE.textWidth,
  fallback: DEFAULT_HTML_LAYOUT.textWidth
}

const FONT_SIZE_FIELD: FieldSpec = {
  noun: 'font size',
  unit: 'px',
  ...HTML_LAYOUT_RANGE.fontSize,
  fallback: DEFAULT_HTML_LAYOUT.fontSize
}

function close(): void {
  uiStore.set({ exportDialog: null })
  focusEditor()
}

interface NumberFieldState {
  draft: string
  value: number
  valid: boolean
  error: string | null
  change: (next: string) => void
  adjust: (direction: -1 | 1) => void
  validate: () => boolean
  spec: FieldSpec
}

function useNumberField(initial: number, spec: FieldSpec): NumberFieldState {
  const [draft, setDraft] = useState(String(initial))
  const [error, setError] = useState<string | null>(null)
  const value = Number(draft)
  const valid =
    draft.trim() !== '' && Number.isFinite(value) && value >= spec.min && value <= spec.max

  const change = (next: string): void => {
    setDraft(next)
    setError(null)
  }

  const adjust = (direction: -1 | 1): void => {
    const current = valid ? value : spec.fallback
    const next = Math.min(spec.max, Math.max(spec.min, current + direction * spec.step))
    change(String(Number(next.toFixed(2))))
  }

  const validate = (): boolean => {
    if (!valid) {
      setError(`Enter a ${spec.noun} from ${spec.min}${spec.unit} to ${spec.max}${spec.unit}.`)
    }
    return valid
  }

  return { draft, value, valid, error, change, adjust, validate, spec }
}

type NumberField = NumberFieldState

function NumberStepper({
  id,
  label,
  testId,
  field,
  autoFocus = false
}: {
  id: string
  label: string
  testId: string
  field: NumberField
  autoFocus?: boolean
}): React.JSX.Element {
  const { draft, value, valid, error, change, adjust, spec } = field
  const errorId = `${id}-error`
  return (
    <div className="setting export-setting">
      <label className="setting-label" htmlFor={id}>
        {label}
      </label>
      <div className="value-stepper">
        <button
          type="button"
          className="button"
          aria-label={`Decrease ${spec.noun}`}
          disabled={valid && value <= spec.min}
          onClick={() => adjust(-1)}
        >
          −
        </button>
        <div className="value-stepper-field">
          <input
            id={id}
            className="text-field"
            data-testid={testId}
            type="number"
            inputMode="decimal"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            autoFocus={autoFocus}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            value={draft}
            onChange={(event) => change(event.target.value)}
          />
          <span aria-hidden="true">{spec.unit}</span>
        </div>
        <button
          type="button"
          className="button"
          aria-label={`Increase ${spec.noun}`}
          disabled={valid && value >= spec.max}
          onClick={() => adjust(1)}
        >
          +
        </button>
      </div>
      {error && (
        <p id={errorId} className="export-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function usePreviewHtml(
  source: ExportSource,
  target: ExportTarget
): { html?: string; error?: string } {
  const [state, setState] = useState<{ html?: string; error?: string }>({})
  useEffect(() => {
    let cancelled = false
    renderExportHtml(source, target).then(
      (html) => {
        if (!cancelled) setState({ html })
      },
      (error: unknown) => {
        if (!cancelled) setState({ error: (error as Error).message ?? String(error) })
      }
    )
    return () => {
      cancelled = true
    }
  }, [source, target])
  return state
}

function ExportFrame({
  title,
  testId,
  hint,
  controls,
  preview,
  exportLabel,
  exportReady,
  onExport
}: {
  title: string
  testId: string
  hint: string
  controls: React.ReactNode
  preview: React.ReactNode
  exportLabel: string
  exportReady: boolean
  onExport: () => void
}): React.JSX.Element {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <form
        className="modal export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        data-testid={testId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          onExport()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close()
          }
        }}
      >
        <header className="modal-header">
          <h1 id="export-dialog-title">{title}</h1>
          <button type="button" className="icon-button" aria-label="Close" onClick={close}>
            <Icon name="close" />
          </button>
        </header>
        <div className="export-dialog-body">
          <div className="export-controls">
            {controls}
            <p className="setting-hint export-hint">{hint}</p>
          </div>
          <div className="export-preview-pane">{preview}</div>
        </div>
        <footer className="modal-footer">
          <button type="button" className="button" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={!exportReady}>
            {exportLabel}
          </button>
        </footer>
      </form>
    </div>
  )
}

function PdfExportDialog(): React.JSX.Element {
  const [source] = useState(captureExportSource)
  const scale = useNumberField(uiStore.get().pdfScalePercent, SCALE_FIELD)
  const { html, error: htmlError } = usePreviewHtml(source, 'pdf')
  const [preview, setPreview] = useState<{ pdf: Uint8Array; percent: number } | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const percent = scale.valid ? scale.value : null

  useEffect(() => {
    if (!html || percent === null) return
    let cancelled = false
    const timer = setTimeout(() => {
      void window.api.previewPdf(html, { scale: percent / 100 }).then((result) => {
        if (cancelled) return
        if (result.ok) {
          setPreview({ pdf: result.pdf, percent })
          setPreviewError(null)
        } else {
          setPreviewError(result.error)
        }
      })
    }, PREVIEW_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [html, percent])

  const startExport = (): void => {
    if (!html || !scale.validate()) return
    uiStore.set({ exportDialog: null, pdfScalePercent: scale.value })
    focusEditor()
    void saveExport('pdf', source, html, { scale: scale.value / 100 })
  }

  return (
    <ExportFrame
      title="Export as PDF"
      testId="pdf-export-options"
      hint="Larger values make content bigger; smaller values fit more on each page."
      exportLabel="Export PDF"
      exportReady={!!html}
      onExport={startExport}
      controls={
        <>
          <NumberStepper
            id="export-scale"
            label="Content scale"
            testId="pdf-scale"
            field={scale}
            autoFocus
          />
          <button
            type="button"
            className="link-button export-reset"
            onClick={() => scale.change(String(SCALE_FIELD.fallback))}
          >
            Reset to {SCALE_FIELD.fallback}%
          </button>
        </>
      }
      preview={
        <PdfPages
          pdf={preview?.pdf ?? null}
          percent={preview?.percent ?? null}
          error={previewError ?? htmlError ?? null}
        />
      }
    />
  )
}

function PdfPages({
  pdf,
  percent,
  error
}: {
  pdf: Uint8Array | null
  percent: number | null
  error: string | null
}): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState<{ percent: number; pages: number } | null>(null)

  useEffect(() => {
    const container = host.current
    if (!container || !pdf || percent === null) return
    let cancelled = false
    let loaded: PDFDocumentProxy | null = null
    container.replaceChildren()
    void (async () => {
      const doc = await pdfjs.getDocument({ data: pdf.slice() }).promise
      if (cancelled) {
        void doc.destroy()
        return
      }
      loaded = doc
      const width = container.clientWidth
      const dpr = window.devicePixelRatio || 1
      for (let number = 1; number <= doc.numPages && !cancelled; number++) {
        const page = await doc.getPage(number)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: (width * dpr) / base.width })
        const canvas = window.document.createElement('canvas')
        canvas.className = 'export-page'
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${width}px`
        canvas.style.height = `${(width * base.height) / base.width}px`
        container.appendChild(canvas)
        await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
      }
      if (!cancelled) setReady({ percent, pages: doc.numPages })
    })()
    return () => {
      cancelled = true
      void loaded?.destroy()
    }
  }, [pdf, percent])

  return (
    <div className="export-preview" data-testid="pdf-preview">
      {error && (
        <p className="export-error" role="alert">
          {error}
        </p>
      )}
      {!pdf && !error && <p className="export-preview-status">Preparing preview…</p>}
      <div
        ref={host}
        className="export-preview-pages"
        data-pages={ready?.pages ?? 0}
        data-ready-scale={ready?.percent}
      />
    </div>
  )
}

function HtmlExportDialog(): React.JSX.Element {
  const [source] = useState(captureExportSource)
  const width = useNumberField(uiStore.get().htmlTextWidth, TEXT_WIDTH_FIELD)
  const fontSize = useNumberField(uiStore.get().htmlFontSize, FONT_SIZE_FIELD)
  const { html, error } = usePreviewHtml(source, 'html-preview')
  const layoutReady = width.valid && fontSize.valid

  const startExport = (): void => {
    const widthValid = width.validate()
    const fontValid = fontSize.validate()
    if (!widthValid || !fontValid) return
    const layout: HtmlLayout = { textWidth: width.value, fontSize: fontSize.value }
    uiStore.set({
      exportDialog: null,
      htmlTextWidth: layout.textWidth,
      htmlFontSize: layout.fontSize
    })
    focusEditor()
    showStatusMessage('Preparing HTML…')
    void renderExportHtml(source, 'html', layout).then((saved) => saveExport('html', source, saved))
  }

  return (
    <ExportFrame
      title="Export as HTML"
      testId="html-export-options"
      hint="The text column and font size of the saved page. The preview shows the page as saved."
      exportLabel="Export HTML"
      exportReady={!!html && layoutReady}
      onExport={startExport}
      controls={
        <>
          <NumberStepper
            id="export-text-width"
            label="Text width"
            testId="html-text-width"
            field={width}
            autoFocus
          />
          <NumberStepper
            id="export-font-size"
            label="Font size"
            testId="html-font-size"
            field={fontSize}
          />
          <button
            type="button"
            className="link-button export-reset"
            onClick={() => {
              width.change(String(TEXT_WIDTH_FIELD.fallback))
              fontSize.change(String(FONT_SIZE_FIELD.fallback))
            }}
          >
            Reset to defaults
          </button>
        </>
      }
      preview={
        <HtmlPreview
          html={html ?? null}
          textWidth={layoutReady ? width.value : null}
          fontSize={layoutReady ? fontSize.value : null}
          error={error ?? null}
        />
      }
    />
  )
}

/** The saved page, scaled to fit the pane. Only the layout values change live. */
function HtmlPreview({
  html,
  textWidth,
  fontSize,
  error
}: {
  html: string | null
  textWidth: number | null
  fontSize: number | null
  error: string | null
}): React.JSX.Element {
  const frame = useRef<HTMLIFrameElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const element = wrap.current
    if (!element) return
    const update = (): void => setFit(element.clientWidth / HTML_PREVIEW_WIDTH)
    const observer = new ResizeObserver(update)
    observer.observe(element)
    update()
    return () => observer.disconnect()
  }, [html])

  const applyLayout = (): void => {
    const doc = frame.current?.contentDocument
    if (!doc || textWidth === null || fontSize === null) return
    doc.documentElement.style.setProperty('--export-text-width', `${textWidth}px`)
    doc.documentElement.style.setProperty('--export-font-size', `${fontSize}px`)
    setHeight(doc.documentElement.scrollHeight)
  }

  useEffect(applyLayout, [html, textWidth, fontSize])

  const onLoad = (): void => {
    const doc = frame.current?.contentDocument
    if (!doc) return
    applyLayout()
    new ResizeObserver(() => setHeight(doc.documentElement.scrollHeight)).observe(doc.body)
  }

  return (
    <div className="export-preview" data-testid="html-preview">
      {error && (
        <p className="export-error" role="alert">
          {error}
        </p>
      )}
      {!html && !error && <p className="export-preview-status">Preparing preview…</p>}
      {html && (
        <div ref={wrap} className="html-preview" style={{ height: height * fit }}>
          <iframe
            ref={frame}
            title="Preview of the saved HTML"
            srcDoc={html}
            sandbox="allow-same-origin"
            scrolling="no"
            onLoad={onLoad}
            style={{
              width: HTML_PREVIEW_WIDTH,
              height,
              transform: `scale(${fit})`,
              transformOrigin: '0 0'
            }}
          />
        </div>
      )}
    </div>
  )
}

export function ExportDialog(): React.JSX.Element | null {
  const { exportDialog } = useUi()
  if (exportDialog === 'pdf') return <PdfExportDialog />
  if (exportDialog === 'html') return <HtmlExportDialog />
  return null
}
