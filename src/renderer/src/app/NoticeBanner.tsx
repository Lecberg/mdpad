import { documentStore } from '../state/documentStore'
import { noticeStore, useNotice } from '../state/noticeStore'

export function NoticeBanner(): React.JSX.Element | null {
  const notice = useNotice()
  if (!notice) return null

  if (notice.kind === 'recovered') {
    const discard = (): void => {
      if (notice.diskFile) documentStore.load(notice.diskFile)
      else documentStore.reset()
      window.api.discardDraft()
      noticeStore.dismiss()
    }
    return (
      <div className="notice" role="status" data-testid="notice">
        <span className="notice-text">
          Recovered unsaved changes from a previous session that didn’t close normally.
        </span>
        <button type="button" onClick={() => noticeStore.dismiss()}>
          Keep
        </button>
        <button type="button" onClick={discard}>
          Discard
        </button>
      </div>
    )
  }

  const reload = (): void => {
    documentStore.load(notice.file)
    noticeStore.dismiss()
  }
  const keepMine = (): void => {
    documentStore.acceptDiskText(notice.file.text)
    noticeStore.dismiss()
  }
  return (
    <div className="notice notice-warning" role="alert" data-testid="notice">
      <span className="notice-text">
        This file was changed by another program, and you have unsaved changes.
      </span>
      <button type="button" onClick={reload}>
        Reload from disk
      </button>
      <button type="button" onClick={keepMine}>
        Keep my version
      </button>
    </div>
  )
}
