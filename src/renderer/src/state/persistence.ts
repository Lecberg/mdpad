import { currentFileText, saveDocument } from '../commands/runCommand'
import { documentStore, type DocState } from './documentStore'
import { noticeStore } from './noticeStore'

// Background saving: autosave for documents that have a file, and crash-recovery drafts
// for any document with unsaved changes. Both wait for a pause in typing, and both hold off
// while a notice (recovered text, outside change) is waiting for the user's decision.

const AUTOSAVE_DELAY_MS = 2000
const DRAFT_DELAY_MS = 2000

const contentOf = (doc: DocState): string | null =>
  doc.mode === 'source' ? doc.sourceText : doc.current

export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastContent: string | null = null
  const unsubscribe = documentStore.subscribe(() => {
    const doc = documentStore.get()
    const content = contentOf(doc)
    if (content === lastContent) return
    lastContent = content
    clearTimeout(timer)
    if (!doc.path || !doc.dirty) return
    timer = setTimeout(() => {
      const latest = documentStore.get()
      if (latest.path && latest.dirty && !noticeStore.get()) void saveDocument({ silent: true })
    }, AUTOSAVE_DELAY_MS)
  })
  return () => {
    clearTimeout(timer)
    unsubscribe()
  }
}

export function startDraftKeeper(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastContent: string | null = null
  let hasDraft = false
  const unsubscribe = documentStore.subscribe(() => {
    const doc = documentStore.get()
    if (!doc.dirty) {
      clearTimeout(timer)
      lastContent = null
      if (hasDraft) {
        window.api.discardDraft()
        hasDraft = false
      }
      return
    }
    const content = contentOf(doc)
    if (content === lastContent) return
    lastContent = content
    clearTimeout(timer)
    timer = setTimeout(() => {
      const latest = documentStore.get()
      if (!latest.dirty) return
      window.api.writeDraft(currentFileText(), latest.format)
      hasDraft = true
    }, DRAFT_DELAY_MS)
  })
  return () => {
    clearTimeout(timer)
    unsubscribe()
  }
}
