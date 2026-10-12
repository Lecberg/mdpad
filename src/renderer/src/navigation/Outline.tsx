import { editorViewCtx } from '@milkdown/kit/core'
import { getActiveEditor, getActiveSourceView } from '../editor/activeEditor'
import { scrollToSourceTarget, scrollToVisualTarget } from '../editor/navigation'
import { useDocInfo } from '../state/docInfoStore'
import { documentStore } from '../state/documentStore'

function navigateTo(target: number): void {
  if (documentStore.get().mode === 'source') {
    const view = getActiveSourceView()
    if (view) scrollToSourceTarget(view, target)
  } else {
    getActiveEditor()?.action((ctx) => scrollToVisualTarget(ctx.get(editorViewCtx), target))
  }
}

export function Outline(): React.JSX.Element {
  const { outline, activeHeading } = useDocInfo()

  if (outline.length === 0) {
    return <p className="outline-empty">Headings in the document appear here.</p>
  }

  const minLevel = Math.min(...outline.map((item) => item.level))
  return (
    <nav aria-label="Outline">
      <ul className="outline" data-testid="outline">
        {outline.map((item, index) => (
          <li key={`${index}-${item.target}`}>
            <button
              type="button"
              className="outline-item"
              style={{ paddingLeft: 12 + (item.level - minLevel) * 14 }}
              aria-current={index === activeHeading ? 'location' : undefined}
              title={item.text}
              onClick={() => navigateTo(item.target)}
            >
              {item.text || <span className="outline-untitled">(empty heading)</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
