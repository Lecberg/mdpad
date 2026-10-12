import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { useEffect } from 'react'
import { setActiveEditor } from './activeEditor'
import { createMarkdownEditor, serializeEditor } from './markdownCore'

interface Props {
  /** Initial Markdown. The editor is remounted (via `key`) to load a different document. */
  markdown: string
  onReady: (markdown: string) => void
  onTouched: () => void
  onChange: (markdown: string) => void
}

function EditorInner({ markdown, onReady, onTouched, onChange }: Props): React.JSX.Element {
  const { loading, get } = useEditor((root) =>
    createMarkdownEditor({ root, markdown, onTouched, onChange })
  )

  useEffect(() => {
    if (loading) return
    const editor = get()
    if (!editor) return
    setActiveEditor(editor)
    onReady(serializeEditor(editor))
    return () => setActiveEditor(null)
    // Runs once per editor instance; callbacks are stable store methods.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return <Milkdown />
}

export function MilkdownEditor(props: Props): React.JSX.Element {
  return (
    <MilkdownProvider>
      <EditorInner {...props} />
    </MilkdownProvider>
  )
}
