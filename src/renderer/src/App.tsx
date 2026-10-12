import { useEffect } from 'react'
import { editorViewCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import { LinkPopover } from './app/LinkPopover'
import { Sidebar } from './app/Sidebar'
import { StatusBar } from './app/StatusBar'
import { installKeymap } from './commands/installKeymap'
import { runCommand } from './commands/runCommand'
import { getActiveEditor, getActiveSourceView } from './editor/activeEditor'
import { MilkdownEditor } from './editor/MilkdownEditor'
import { SourceEditor } from './source/SourceEditor'
import { documentStore, useDocument } from './state/documentStore'
import { uiStore, useUi } from './state/uiStore'

// Requested once per window (not per effect run) so StrictMode's double effects can't
// consume the initial file twice.
const initialFile = window.api.windowReady()

function fileName(path: string | null): string {
  return path ? path.split(/[\\/]/).pop()! : 'Untitled'
}

/** Clicking the empty space around the document puts the caret at the end. */
function focusEditorEnd(event: React.MouseEvent): void {
  if (event.target !== event.currentTarget) return
  event.preventDefault()
  const source = getActiveSourceView()
  if (source) {
    source.dispatch({ selection: { anchor: source.state.doc.length } })
    source.focus()
    return
  }
  getActiveEditor()?.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)))
    view.focus()
  })
}

function App(): React.JSX.Element {
  const doc = useDocument()
  const ui = useUi()

  useEffect(() => {
    let cancelled = false
    void initialFile.then((file) => {
      if (file && !cancelled && documentStore.get().path === null) documentStore.load(file)
    })
    const offLoad = window.api.onLoadFile((file) => documentStore.load(file))
    const offCommand = window.api.onMenuCommand((event) => void runCommand(event))
    const offKeymap = installKeymap()
    return () => {
      cancelled = true
      offLoad()
      offCommand()
      offKeymap()
    }
  }, [])

  useEffect(() => {
    document.title = `${doc.dirty ? '● ' : ''}${fileName(doc.path)} — mdpad`
  }, [doc.path, doc.dirty])

  // After switching between visual and source mode, restore the relative scroll position
  // once the new editor has rendered its content.
  const editorReady = doc.mode === 'source' || doc.baseline !== null
  useEffect(() => {
    const ratio = uiStore.get().pendingScrollRatio
    if (ratio === null || !editorReady) return
    requestAnimationFrame(() => {
      const scroller = document.querySelector('.editor-scroll')
      if (scroller) scroller.scrollTop = ratio * (scroller.scrollHeight - scroller.clientHeight)
      uiStore.set({ pendingScrollRatio: null })
    })
  }, [doc.loadId, editorReady])

  return (
    <div className="app">
      <div className="workspace">
        {ui.sidebarOpen && <Sidebar />}
        <main className="editor-scroll" onMouseDown={focusEditorEnd}>
          <div
            className={doc.mode === 'source' ? 'page page-source' : 'page'}
            onMouseDown={focusEditorEnd}
          >
            {doc.mode === 'source' ? (
              <SourceEditor
                key={doc.loadId}
                text={doc.sourceText}
                onTouched={documentStore.touched}
                onChange={documentStore.sourceChanged}
              />
            ) : (
              <MilkdownEditor
                key={doc.loadId}
                markdown={doc.original}
                onReady={documentStore.editorReady}
                onTouched={documentStore.touched}
                onChange={documentStore.editorChanged}
              />
            )}
          </div>
        </main>
      </div>
      <StatusBar doc={doc} />
      <LinkPopover />
    </div>
  )
}

export default App
