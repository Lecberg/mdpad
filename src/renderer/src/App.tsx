import { useEffect } from 'react'
import { editorViewCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import { FindBar } from './app/FindBar'
import { LinkPopover } from './app/LinkPopover'
import { NoticeBanner } from './app/NoticeBanner'
import { QuickOpen } from './app/QuickOpen'
import { Sidebar } from './app/Sidebar'
import { StatusBar } from './app/StatusBar'
import { saveImages } from './commands/images'
import { installKeymap } from './commands/installKeymap'
import { revealMatch } from './commands/openDocument'
import { runCommand } from './commands/runCommand'
import { getActiveEditor, getActiveSourceView } from './editor/activeEditor'
import { MilkdownEditor } from './editor/MilkdownEditor'
import { SettingsDialog } from './settings/SettingsDialog'
import { SourceEditor } from './source/SourceEditor'
import type { LoadedFile } from '../../shared/ipc-types'
import { documentStore, useDocument } from './state/documentStore'
import { startFolderSync } from './state/folderStore'
import { noticeStore } from './state/noticeStore'
import { uiStore, useUi } from './state/uiStore'

// Requested once per window (not per effect run) so StrictMode's double effects can't
// consume the initial document twice.
const initialDoc = window.api.windowReady()

const interactive = { saveImages }

/** Another program changed the open file. */
function onFileChanged(file: LoadedFile): void {
  const doc = documentStore.get()
  if (file.text === doc.diskText) return // our own save, or no real change
  if (doc.dirty || doc.changePending) noticeStore.show({ kind: 'externalChange', file })
  else documentStore.load(file)
}

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
    void initialDoc.then((initial) => {
      if (cancelled || documentStore.get().loadId !== 0) return
      if (!initial.file && initial.recoveredText === null) return
      documentStore.loadInitial(initial)
      if (initial.recoveredText !== null) {
        noticeStore.show({ kind: 'recovered', diskFile: initial.file })
      }
    })
    const offLoad = window.api.onLoadFile((file) => documentStore.load(file))
    const offChanged = window.api.onFileChanged(onFileChanged)
    const offRenamed = window.api.onDocRenamed((path) => documentStore.renamed(path))
    const offCommand = window.api.onMenuCommand((event) => void runCommand(event))
    const offFolder = startFolderSync()
    const offKeymap = installKeymap()
    return () => {
      cancelled = true
      offLoad()
      offChanged()
      offRenamed()
      offCommand()
      offFolder()
      offKeymap()
    }
  }, [])

  useEffect(() => {
    document.title = `${doc.dirty || doc.changePending ? '● ' : ''}${fileName(doc.path)} — mdpad`
  }, [doc.path, doc.dirty, doc.changePending])

  // Once a newly mounted editor has rendered its content: after switching between visual
  // and source mode, restore the relative scroll position; after opening a folder search
  // result, select the match.
  const editorReady = doc.mode === 'source' || doc.baseline !== null
  useEffect(() => {
    const { pendingScrollRatio: ratio, pendingReveal: reveal } = uiStore.get()
    if ((ratio === null && reveal === null) || !editorReady) return
    requestAnimationFrame(() => {
      const scroller = document.querySelector('.editor-scroll')
      if (scroller && ratio !== null) {
        scroller.scrollTop = ratio * (scroller.scrollHeight - scroller.clientHeight)
      }
      if (reveal) revealMatch(reveal)
      uiStore.set({ pendingScrollRatio: null, pendingReveal: null })
    })
  }, [doc.loadId, editorReady])

  return (
    <div className="app">
      <div className="workspace">
        {ui.sidebarOpen && <Sidebar />}
        <main className="editor-column">
          <NoticeBanner />
          <FindBar />
          <div className="editor-scroll" onMouseDown={focusEditorEnd}>
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
                  interactive={interactive}
                />
              )}
            </div>
          </div>
        </main>
      </div>
      <StatusBar doc={doc} />
      <LinkPopover />
      <QuickOpen />
      <SettingsDialog />
    </div>
  )
}

export default App
