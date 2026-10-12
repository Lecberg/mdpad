import { BrowserWindow, shell, type WebContents } from 'electron'
import { promises as fs } from 'fs'
import { watchFile } from './services/fileWatcher'

const TEMPLATE = `/*
  mdpad custom CSS: applied to every window, and re-applied whenever you save this file.

  The easiest way to restyle the app is to override its design variables, e.g.:

  :root {
    --color-link: #0b7a75;
    --page-padding-top: 32px;
  }

  :root[data-theme='dark'] {
    --color-bg: #15171a;
  }

  The full list of variables is in the app's tokens.css.
*/
`

/** The user's own stylesheet (userData/custom.css), injected into every window. */
export class CustomCss {
  private css = ''
  private readonly inserted = new Map<number, string>()

  constructor(private readonly path: string) {}

  async load(): Promise<void> {
    await this.read()
    watchFile(this.path, () => void this.reload())
  }

  private async read(): Promise<void> {
    try {
      this.css = await fs.readFile(this.path, 'utf8')
    } catch {
      this.css = ''
    }
  }

  async apply(contents: WebContents): Promise<void> {
    const id = contents.id
    const previous = this.inserted.get(id)
    this.inserted.delete(id)
    if (previous) await contents.removeInsertedCSS(previous).catch(() => {})
    if (!this.css.trim() || contents.isDestroyed()) return
    this.inserted.set(id, await contents.insertCSS(this.css, { cssOrigin: 'author' }))
  }

  /** A window closed (its WebContents is already destroyed, so only its id is passed). */
  forget(contentsId: number): void {
    this.inserted.delete(contentsId)
  }

  private async reload(): Promise<void> {
    await this.read()
    for (const win of BrowserWindow.getAllWindows()) void this.apply(win.webContents)
  }

  /** Open the file in the user's editor for .css files, creating it on first use. */
  async open(): Promise<void> {
    try {
      await fs.writeFile(this.path, TEMPLATE, { flag: 'wx' })
    } catch {
      // already exists
    }
    await shell.openPath(this.path)
  }
}
