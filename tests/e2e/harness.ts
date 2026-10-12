import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  _electron as electron,
  test as base,
  type ElectronApplication,
  type Page
} from '@playwright/test'

const fixturesDir = join(__dirname, '../fixtures')

/** One launched app plus a scratch folder for the files it edits. */
export class Mdpad {
  readonly dir = mkdtempSync(join(tmpdir(), 'mdpad-e2e-'))
  private launched: { app: ElectronApplication; page: Page } | null = null

  get app(): ElectronApplication {
    if (!this.launched) throw new Error('call launch() first')
    return this.launched.app
  }

  get page(): Page {
    if (!this.launched) throw new Error('call launch() first')
    return this.launched.page
  }

  async launch(...files: string[]): Promise<void> {
    const app = await electron.launch({ args: ['.', ...files] })
    const page = await app.firstWindow()
    await page.locator('.ProseMirror').waitFor()
    this.launched = { app, page }
  }

  /** Copy a file from tests/fixtures into the scratch folder; returns its path. */
  copyFixture(name: string): string {
    const path = join(this.dir, name)
    copyFileSync(join(fixturesDir, name), path)
    return path
  }

  writeFile(name: string, text: string): string {
    const path = join(this.dir, name)
    writeFileSync(path, text)
    return path
  }

  read(path: string): string {
    return readFileSync(path, 'utf8')
  }

  /**
   * Select the first occurrence of `text` in the visual editor, or with `collapse` put the
   * caret at its start or end. Deterministic, unlike click + Home/End: a key pressed right
   * after a click can be overridden when ProseMirror applies the click's selection.
   */
  async selectText(text: string, collapse?: 'start' | 'end'): Promise<void> {
    await this.page.evaluate(
      ([needle, edge]) => {
        const root = document.querySelector('.ProseMirror')!
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const index = node.textContent!.indexOf(needle)
          if (index < 0) continue
          ;(root as HTMLElement).focus()
          const range = document.createRange()
          range.setStart(node, edge === 'end' ? index + needle.length : index)
          range.setEnd(node, edge === 'start' ? index : index + needle.length)
          const selection = window.getSelection()!
          selection.removeAllRanges()
          selection.addRange(range)
          return
        }
        throw new Error(`text not found: ${needle}`)
      },
      [text, collapse] as const
    )
    // ProseMirror picks up DOM selection changes asynchronously.
    await this.page.waitForTimeout(50)
  }

  /** Click a native menu item by id, as a user would with the mouse. */
  async clickMenu(id: string): Promise<void> {
    await this.app.evaluate(({ BrowserWindow, Menu }, itemId) => {
      const win = BrowserWindow.getAllWindows()[0]
      Menu.getApplicationMenu()!.getMenuItemById(itemId)!.click(undefined, win, win.webContents)
    }, id)
  }

  async dispose(): Promise<void> {
    if (this.launched) {
      // Answer "Don't Save" if a close prompt appears, so teardown never blocks.
      await this.launched.app
        .evaluate(({ dialog }) => {
          dialog.showMessageBoxSync = () => 1
        })
        .catch(() => {}) // the test may already have closed the app
      await this.launched.app.close()
    }
    rmSync(this.dir, { recursive: true, force: true })
  }
}

export const test = base.extend<{ mdpad: Mdpad }>({
  // eslint-disable-next-line no-empty-pattern
  mdpad: async ({}, provide) => {
    const mdpad = new Mdpad()
    await provide(mdpad)
    await mdpad.dispose()
  }
})

export { expect } from '@playwright/test'
