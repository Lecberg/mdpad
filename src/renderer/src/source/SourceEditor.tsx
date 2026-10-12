import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  type ViewUpdate
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { useEffect, useRef } from 'react'
import { setActiveSourceView } from '../editor/activeEditor'
import {
  activeHeadingIndex,
  countCharacters,
  countWords,
  docInfoStore,
  outlineFromSource
} from '../state/docInfoStore'

const SERIALIZE_DELAY_MS = 150

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '600', color: 'var(--color-text)' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--color-link)' },
  { tag: tags.monospace, color: 'var(--color-code-text)' },
  {
    tag: [tags.processingInstruction, tags.meta, tags.contentSeparator],
    color: 'var(--color-muted)'
  },
  { tag: tags.quote, color: 'var(--color-muted)' },
  { tag: tags.keyword, color: 'var(--color-syntax-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--color-syntax-string)' },
  { tag: tags.comment, color: 'var(--color-muted)', fontStyle: 'italic' },
  { tag: [tags.number, tags.bool, tags.atom], color: 'var(--color-syntax-number)' }
])

function publishDocInfo(state: EditorState, docChanged: boolean): void {
  if (docChanged) {
    const text = state.doc.toString()
    docInfoStore.set({
      outline: outlineFromSource(text),
      words: countWords(text),
      characters: countCharacters(text)
    })
  }
  const active = activeHeadingIndex(docInfoStore.get().outline, state.selection.main.head)
  if (active !== docInfoStore.get().activeHeading) docInfoStore.set({ activeHeading: active })
}

interface Props {
  /** Initial text. The component is remounted (via `key`) to load different text. */
  text: string
  onTouched: () => void
  onChange: (text: string) => void
}

export function SourceEditor({ text, onTouched, onChange }: Props): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let changeTimer: ReturnType<typeof setTimeout> | undefined
    let infoTimer: ReturnType<typeof setTimeout> | undefined
    let infoDocChanged = false

    const onUpdate = (update: ViewUpdate): void => {
      if (update.docChanged) {
        onTouched()
        clearTimeout(changeTimer)
        changeTimer = setTimeout(
          () => onChange(update.view.state.doc.toString()),
          SERIALIZE_DELAY_MS
        )
      }
      if (update.docChanged || update.selectionSet) {
        infoDocChanged ||= update.docChanged
        infoTimer ??= setTimeout(() => {
          infoTimer = undefined
          publishDocInfo(update.view.state, infoDocChanged)
          infoDocChanged = false
        }, 120)
      }
    }

    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: text,
        extensions: [
          history(),
          drawSelection(),
          highlightActiveLine(),
          EditorView.lineWrapping,
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          syntaxHighlighting(markdownHighlight),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.contentAttributes.of({ spellcheck: 'false', 'aria-label': 'Markdown source' }),
          EditorView.updateListener.of(onUpdate)
        ]
      })
    })
    publishDocInfo(view.state, true)
    setActiveSourceView(view)
    view.focus()

    return () => {
      clearTimeout(changeTimer)
      clearTimeout(infoTimer)
      setActiveSourceView(null)
      view.destroy()
    }
    // Mounted once per text load; callbacks are stable store methods.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="source-editor" ref={host} data-testid="source-editor" />
}
