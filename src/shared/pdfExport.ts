// PDF export options shared by the dialog, preload bridge and main process.

export interface PdfExportOptions {
  /** Webpage rendering scale: 1 is 100%. */
  scale: number
}

export const PDF_SCALE_PERCENT = {
  min: 25,
  max: 200,
  default: 100,
  step: 5
} as const

export function isPdfExportOptions(value: unknown): value is PdfExportOptions {
  if (!value || typeof value !== 'object') return false
  const { scale } = value as Partial<PdfExportOptions>
  return (
    typeof scale === 'number' &&
    Number.isFinite(scale) &&
    scale >= PDF_SCALE_PERCENT.min / 100 &&
    scale <= PDF_SCALE_PERCENT.max / 100
  )
}
