/** Layout the HTML export can be adjusted with; the defaults match the stylesheet's own. */
export interface HtmlLayout {
  /** Maximum width of the text column in px. */
  textWidth: number
  /** Body text size in px. */
  fontSize: number
}

export const DEFAULT_HTML_LAYOUT: HtmlLayout = { textWidth: 820, fontSize: 16 }

export const HTML_LAYOUT_RANGE = {
  textWidth: { min: 560, max: 1200, step: 20 },
  fontSize: { min: 12, max: 24, step: 1 }
} as const
