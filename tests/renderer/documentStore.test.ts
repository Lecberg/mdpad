import { beforeEach, describe, expect, it } from 'vitest'
import { documentStore } from '@renderer/state/documentStore'

const file = { path: 'C:\\notes\\a.md', text: '# A\n\nBody\n', eol: '\n' as const, bom: false }

beforeEach(() => {
  documentStore.load(file)
  documentStore.editorReady('# A\n\nBody\n')
})

describe('visual mode', () => {
  it('is clean after load and dirty after an edit', () => {
    expect(documentStore.get().dirty).toBe(false)
    documentStore.editorChanged('# A\n\nBody!\n')
    expect(documentStore.get().dirty).toBe(true)
    documentStore.editorChanged('# A\n\nBody\n')
    expect(documentStore.get().dirty).toBe(false)
  })

  it('marks unread changes as pending until they are serialized', () => {
    documentStore.touched()
    expect(documentStore.get().changePending).toBe(true)
    documentStore.editorChanged('# A\n\nBody\n')
    expect(documentStore.get().changePending).toBe(false)
  })
})

describe('source mode', () => {
  it('is clean when entered with the file text and dirty after editing', () => {
    documentStore.enterSource(file.text)
    expect(documentStore.get()).toMatchObject({ mode: 'source', dirty: false })
    documentStore.sourceChanged('# A\n\nEdited\n')
    expect(documentStore.get().dirty).toBe(true)
  })

  it('carries source edits back into visual mode as the new merge base', () => {
    const before = documentStore.get().loadId
    documentStore.enterSource(file.text)
    documentStore.sourceChanged('Setext\n===\n')
    documentStore.exitSource()
    const state = documentStore.get()
    expect(state).toMatchObject({ mode: 'wysiwyg', original: 'Setext\n===\n', dirty: true })
    expect(state.loadId).toBe(before + 2)
    // The remounted editor reports its serialization; still dirty relative to disk.
    documentStore.editorReady('# Setext\n')
    expect(documentStore.get()).toMatchObject({ dirty: true, normalizes: true })
  })

  it('a round trip without edits stays clean', () => {
    documentStore.enterSource(file.text)
    documentStore.exitSource()
    documentStore.editorReady('# A\n\nBody\n')
    expect(documentStore.get().dirty).toBe(false)
  })

  it('saving in source mode records the written text', () => {
    documentStore.enterSource(file.text)
    documentStore.sourceChanged('changed\n')
    documentStore.saveSucceeded(file.path, 'changed\n', null)
    expect(documentStore.get()).toMatchObject({ diskText: 'changed\n', dirty: false })
  })
})
