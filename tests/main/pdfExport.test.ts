import { describe, expect, it } from 'vitest'
import { isPdfExportOptions, PDF_SCALE_PERCENT } from '../../src/shared/pdfExport'

describe('isPdfExportOptions', () => {
  it('accepts finite scales within the supported percentage range', () => {
    expect(isPdfExportOptions({ scale: PDF_SCALE_PERCENT.min / 100 })).toBe(true)
    expect(isPdfExportOptions({ scale: 1 })).toBe(true)
    expect(isPdfExportOptions({ scale: PDF_SCALE_PERCENT.max / 100 })).toBe(true)
  })

  it('rejects missing, non-numeric, non-finite and out-of-range scales', () => {
    const invalid = [
      undefined,
      null,
      {},
      { scale: '1' },
      { scale: Number.NaN },
      { scale: Number.POSITIVE_INFINITY },
      { scale: PDF_SCALE_PERCENT.min / 100 - 0.01 },
      { scale: PDF_SCALE_PERCENT.max / 100 + 0.01 }
    ]
    for (const value of invalid) expect(isPdfExportOptions(value)).toBe(false)
  })
})
