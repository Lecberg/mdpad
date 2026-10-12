import { useEffect } from 'react'
import { editorViewCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import { StatusBar } from './app/StatusBar'
import { runCommand } from './commands/runCommand'
import { getActiveEditor } from './editor/activeEditor'
import { MilkdownEditor } from './editor/MilkdownEditor'
import { documentStore, useDocument } from './state/documentStore'

// Requested once per window (not per effect run) so StrictMode's double effects can't
// consume the initial file twice.
const initialFile = window.api.windowReady()

function fileName(path: string | null): string {
  return path ? path.split(/[\\/]/).pop()! : 'Untitled'
}

/** Clicking the empty space below the document puts the caret at the end. */
function focusEditorEnd(event: React.MouseEvent): void {
  if (event.target !== event.currentTarget) return
  getActiveEditor()?.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)))
    view.focus()
  })
  event.preventDefault()
}

function App(): React.JSX.Element {
  const doc = useDocument()

  useEffect(() => {
    let cancelled = false
    void initialFile.then((file) => {
      if (file && !cancelled && documentStore.get().path === null) documentStore.load(file)
    })
    const offLoad = window.api.onLoadFile((file) => documentStore.load(file))
    const offCommand = window.api.onMenuCommand((event) => void runCommand(event))
    return () => {
      cancelled = true
      offLoad()
      offCommand()
    }
  }, [])

  useEffect(() => {
    document.title = `${doc.dirty ? '● ' : ''}${fileName(doc.path)} — mdpad`
  }, [doc.path, doc.dirty])

  return (
    <div className="app">
      <div className="editor-scroll" onMouseDown={focusEditorEnd}>
        <div className="page" onMouseDown={focusEditorEnd}>
          <MilkdownEditor
            key={doc.loadId}
            markdown={doc.original}
            onReady={documentStore.editorReady}
            onTouched={documentStore.editorTouched}
            onChange={documentStore.editorChanged}
          />
        </div>
      </div>
      <StatusBar doc={doc} />
    </div>
  )
}

export default App
